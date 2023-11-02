import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { readFileSync } from 'fs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
// import * as tg from 'aws-cdk-lib/aws_elasticloadbalancingv2_targets'
import { aws_elasticloadbalancingv2_targets as targets } from 'aws-cdk-lib';
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2_targets.AlbArnTarget.html
// これによるとimport * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";という形じゃないんだが。。。
import { WebServerInstance } from './constructs/web-server-instance';

export class CdkWorkshopStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  // VPCをデプロイする
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16')
    });  
  // EC2インスタンスをデプロイする
    const webServer1 = new WebServerInstance(this, 'WebServer1', {vpc});
    // webServer1.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
   // 2 台目のインスタンスを宣言
    const webServer2 = new WebServerInstance(this, 'WebServer2', {
      vpc,
    });

    // RDSをデプロイする
    const dbServer = new rds.DatabaseInstance(this, 'WordPressDB', {
      vpc: vpc,
      engine: rds.DatabaseInstanceEngine.mysql({version: rds.MysqlEngineVersion.VER_8_0_31}),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
      databaseName: "wordpress",
      multiAz: true,

    });
    dbServer.connections.allowDefaultPortFrom(webServer1.instance);
    dbServer.connections.allowDefaultPortFrom(webServer2.instance);

    // ELBをデプロイする
    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true,
    });
    // リスナーを作成&リスナーにターゲットを紐付ける
    const listener = lb.addListener('Listener', { port: 80 });
    listener.addTargets('Target', {
      port:80 ,
      healthCheck: {path: '/wp-includes/images/blank.gif'}, 
      targets: [new targets.InstanceTarget(webServer1.instance , 80), new targets.InstanceTarget(webServer2.instance , 80)]
    });
    // CDKセキュリティグループばらばらだと見づらそう
    webServer1.instance.connections.allowFrom(lb, ec2.Port.tcp(80));
    webServer2.instance.connections.allowFrom(lb, ec2.Port.tcp(80));

  }
}
