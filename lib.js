var lib = {};

lib.getOriginPoolName = function(name) {

    var parts = [
        'aws',
        process.env.AWS_REGION,
        name
    ];

    return parts.join('_');
}

lib.processAutoscalingEvent = async function(event, AWS, CF) {

    console.info('Started synchronising Auto Scaling Group with Cloudflare Load Balancing Origin Pool');

    console.debug(JSON.stringify(event));

    const _ = require('lodash');

    const autoscaling = new AWS.AutoScaling();

    const ec2 = new AWS.EC2({
        apiVersion: '2016-11-15'
    });

    var autoScalingGroupName = event.detail.AutoScalingGroupName;

    const params = { "AutoScalingGroupNames": [autoScalingGroupName ] };

    console.log('Describing Auto Scaling Group: ' + autoScalingGroupName);
    console.debug(JSON.stringify(params));

    var data = await autoscaling.describeAutoScalingGroups(params).promise();

    console.debug(JSON.stringify(data));

    var instanceIds = [];

    if (data.AutoScalingGroups.length < 1) {
        console.warn('Could not find Auto Scaling Group: ' + process.env.AWS_REGION + ':' + autoScalingGroupName);
        return;
    }

    console.info('Started generating list of EC2 Instance IDs');

    for (var i in data.AutoScalingGroups[0].Instances) {
        instanceIds.push(data.AutoScalingGroups[0].Instances[i].InstanceId);
    }

    console.info('Finished generating list of EC2 Instance IDs')
    
    console.debug(JSON.stringify(instanceIds));

    if (instanceIds.length < 1) {
        console.warn('Autoscaling group does not contain any EC2 instances: ' + process.env.AWS_REGION + ':' + autoScalingGroupName);
        return;
    }

    console.info('Started describing EC2 Instances');

    var instanceInfo = await ec2.describeInstances({
        "InstanceIds": instanceIds
    }).promise();

    console.info('Finished describing EC2 Instances');
    console.debug(JSON.stringify(instanceInfo));

    console.info('Started generating origin list');

    var origins = [];

    for (var i in instanceInfo.Reservations) {

        var instanceIPv4 = _.get(instanceInfo.Reservations[i].Instances[0], 'PublicIpAddress') || null;
        var instanceIPv6 = _.get(instanceInfo.Reservations[i].Instances[0].NetworkInterfaces[0], 'Ipv6Addresses[0].Ipv6Address') || null;
        
        var origin = {
            "name": instanceInfo.Reservations[i].Instances[0].InstanceId,
            "address": instanceIPv4,
            "enabled": true
        };

        if (instanceIPv6) {
            var useIPv6 = (process.env.ENABLE_IPv6_ORIGINS || false);
            if (useIPv6) {
                console.info('This EC2 instance has an IPv6 Address. Setting IPv6 Address as origin address');
                origin.address = instanceIPv6;
            } else {
                console.info('process.env.ENABLE_IPv6_ORIGINS is not enabled. Defaulting to IPv4 public IP.');
            }
        }

        if (instanceInfo.Reservations[i].Instances[0].State.Name != 'running') {
            console.info('This EC2 instance status is not \'running\'. Setting this origin as not enabled');
            origin.enabled = false;
        }

        if (origin.address == null) {
            console.info('This EC2 instance does not have a public IPv4 address and the first Network Interface does not have an IPv6 address. This EC2 instance will be excluded from the Origin Pool.'); // This is likely some unusual configuration consider future development not necessary for MVP.
        } else {
            console.info('Including EC2 instance to Origin Pool instances list.');
            origins.push(origin);
        }

        console.debug(JSON.stringify(origin));

    }

    console.info('Finished generating origin list')

    if (origins.length == 0) {
        console.warn('Origin list is empty, aborting script and not modifying Cloudflare Origin Pool configuration.');
        return;
    }

    var poolName = lib.getOriginPoolName(event.detail.AutoScalingGroupName);
    console.info('Generated Cloudflare Origin Pool Name: ' + poolName);
    console.info('Fetching Origin Pool named: ' + poolName);
    var pool = await CF.getLoadBalancerPoolByName(poolName);

    console.info('Completed fetching Origin Pool data from Cloudflare API');

    console.debug(JSON.stringify(pool));

    if (pool) {
        console.log('Origin pool already exists. Updating origin pool with latest origin state', pool.id);
        pool = await CF.updateLoadBalancerOriginPool(pool.id, poolName, origins);
        console.log('Successfully updated Cloudflare Origin Pool.');
        console.debug(JSON.stringify(pool));

    } else {
        console.log('Cloudflare Origin Pool does not exist. Creating a new Origin Pool with latest EC2 instance state');
        pool = await CF.createLoadBalancerOriginPool(poolName, origins);
        console.log('Successfully created Cloudflare Origin Pool');
        console.info('Note: This Origin Pool is not enabled by default and not allocated to any load balancers. You can enable traffic to this Origin Pool via the Cloudflare Dashboard or API');
        console.debug(JSON.stringify(pool));
    }

    console.info('Finished synchronising Auto Scaling Group with Cloudflare Load Balancing Origin Pool');

}

module.exports = lib;