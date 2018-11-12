# Cloudflare - Auto Scaling Group to Cloudflare Load Balancing Synchronisation

A Serverless Lambda function which dynamically manages Cloudflare Origin Pools from AWS Auto Scaling Group events.

This Serverless function observes `aws.autoscaling` - `EC2 Instance Launch Successful` and `EC2 Instance Terminate Successful` events and automatically creates / updates a Cloudflare Origin Pool with all EC2 instance public ip.

## Installation

1. Install Serverless. https://github.com/serverless/serverless
2. Create a env.yml file. `cp env.yml.example env.yml`.
3. Update `CLOUDFLARE_EMAIL` and `CLOUDFLARE_TOKEN` with your credentials.
4. Deploy to your region: `serverless deploy --region $AWS_REGION --stage prod`.

## Notes

### Existing Groups

This function is invoked when an autoscaling event occurs. When the ASG triggers a new instance creation or an instance is terminated the Cloudflare Origin Pool will be created in full with all instances in the pool.

### Multiple regions

This script is scoped to the region, however it will work with multiple regions by deploying it multiple times in each region you require.

Region A: `serverless deploy --region us-east-1 --stage prod`

Region B: `serverless deploy --region us-west-1 --stage prod`

### IPv6 Support

Cloudflare supports IPv6 out of the box. When an environment variable `ENABLE_IPv6_ORIGINS` is set the Lambda function will prioritize an available IPv6 address over the public IPv4.

# Learn more

https://www.cloudflare.com/load-balancing/
