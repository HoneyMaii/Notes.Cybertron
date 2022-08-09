# Alibaba--Nacos

## Nacos 基本架构和概念



### 概念解读

- **服务注册中心**：它是服务、示例和元数据的数据库；服务注册中心可能会调用服务实例的健康检查 API 来验证它是否能够处理请求
- **服务元数据**：包括服务端点（endpoints)、服务标签、服务版本号、服务实例权重、路由规则、安全策略等描述服务的数据

- **服务提供方、消费方**：提供可复用和可调用服务的应用方；会发起对某个服务调用的应用方
- **配置**：在系统开发过程中通常会将一些需要变更的参数、变量等从代码中分离出来独立管理，以独立的配置文件的形式存在



## Nacos 的基本使用

### 1. 命名空间

可以隔离配置集，将某些配置放到某一个命名空间下。

命名空间名称我们一般用来区分微服务



### 2. Group（组）

> 引言：现在确实可以隔离微服务，但是不同的微服务的开发、测试、生产环境如何来区别呢？

我们可以使用组来区别开发、测试、生产环境



### 3. dataid - 配置集

一个配置集就是一个配置文件，实际上可以更灵活





## 部署 Alibaba Nacos

### 单机版本部署步骤

- 下载需要的版本[https://github.com/alibaba/nacos/releases](https://github.com/alibaba/nacos/releases)

- 解压：`tar -xzvf nacos-server-2.1.0.tar.gz`

- 单机模式启动（默认配置就可以）：`./startup.sh -m standalone`

- 查看 nacos 配置信息：`vim /nacos/conf/application.properties`

  ![image-20220807153652304](/Alibaba--Nacos.assets/image-20220807153652304.png)

- 在浏览器输入地址查看：`<your-ipaddress>:8848/nacos`

  默认账户：nacos

  默认密码：nacos

  ![image-20220807153927330](/Alibaba--Nacos.assets/image-20220807153927330.png)

- 模块介绍

  1. **服务管理/服务列表** 当前已经注册到 nacos 上的服务。

  2. **命名空间**：不同的产品可以根据命名空间进行管理，

     ![image-20220807154155804](/Alibaba--Nacos.assets/image-20220807154155804.png)

  

#### 给 Nacos 配置自定义的 MySQL 持久化

默认情况下，在单机模式nacos时，其使用嵌入式数据库实现数据库的存储，不方便开发与维护、在部署docker时，应使用`mysql`存储、在`windows`的下载包中`conf`有一个`nacos-mysql.sql` 文件初始化数据库。创建一个数据库，起名为`nacos`，可任意命名。

- conf目录还有一个`application.properties`,这是一个配置文件，打开后，可配置具体的 `mysql`，一般情况下建议创建一个新的用户名和密码。并配置其权限为 `nacos` 数据库

- 修改配置，指定 MySQL 地址、用户名、端口号

  ```
  ### If use MySQL as datasource:
   spring.datasource.platform=mysql
  
  ### Count of DB:
   db.num=1
  
  ### Connect URL of DB:
   db.url.0=jdbc:mysql://127.0.0.1:3306/nacos?characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=UTC
   db.user.0=nacos
   db.password.0=nacos
  ```

  

- 结束进程 `kill -9 pid` ，然后重新启动 `./startup.sh -m standalon`

### 集群化部署

#### 集群化部署 Nacos 步骤

#### 1. 定义集群部署的 ip 和端口，即 cluster.conf 文件

> 官方为我们提供了一个示例文件： `/nacos/bin/conf/cluster.conf.example`
>
> ```bash
> #
> # Licensed under the Apache License, Version 2.0 (the "License");
> # you may not use this file except in compliance with the License.
> # You may obtain a copy of the License at
> #
> #      http://www.apache.org/licenses/LICENSE-2.0
> #
> # Unless required by applicable law or agreed to in writing, software
> # distributed under the License is distributed on an "AS IS" BASIS,
> # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
> # See the License for the specific language governing permissions and
> # limitations under the License.
> #
> 
> #it is ip
> #example
> 192.168.16.101:8847
> 192.168.16.102
> 192.168.16.103
> ```
>
> 把所有集群的ip+端口加到这里 

#### 2.集群必须要使用可以共同访问（例如 Mysql、PG 等）到的数据源作为持久化的方式（application.properties 中配置数据库连接信息）

#### 3. 集群化启动没有额外的参数：`./startup.sh`



## Alibaba Nacos Clients 的服务注册

![image-20220807172526569](/Alibaba--Nacos.assets/image-20220807172526569.png)



## Nacos 配置中心 + ASP.NetCore



### 1.新增包

```csharp
<PackageReference Include="nacos-sdk-csharp.AspNetCore" Version="1.2.2" />
<PackageReference Include="nacos-sdk-csharp.Extensions.Configuration" Version="1.2.2" />
```

### 2.Program 中配置服务

```csharp
/// <summary>
/// 配置 Nacos
/// </summary>
/// <param name="builder"></param>
public static void GetNacosConfig(ConfigurationManager builder)
{
  // 从配置文件读取Nacos相关配置
  // 默认会使用JSON解析器来解析存在 Nacos Server的配置
  builder.AddNacosV2Configuration(builder.GetSection("NacosConfig"));
}
```

### 3.`appsetting.json` 配置

```json
{
  "NacosConfig": {
    "Listeners": [ // 对应配置文件 DataId是配置名称，Tenant是命名空间名称。Group组名
      {
        "Optional": false,
        "DataId": "common",
        "Group": "DEFAULT_GROUP"
      },
      {
        "Optional": false,
        "DataId": "project-common-redis",
        "Group": "DEFAULT_GROUP"
      }
    ],
		//"Namespace": "public",
    "ServerAddresses": [ "http://101.133.132.113:8858/" ], // Nacos的服务器地址，可以添加多个
    "UserName": "nacos",
    "Password": "nacos",
    "ConfigUseRpc":false,
    "NamingUseRpc":false
  }
}
```

![image-20220809224255990](/Alibaba--Nacos.assets/image-20220809224255990.png)

![image-20220809224323891](/Alibaba--Nacos.assets/image-20220809224323891.png)

![image-20220809224345414](/Alibaba--Nacos.assets/image-20220809224345414.png)

> **注意**
>
> - 当2个`DataId`中配置的json,包含相同的Key时，实际会依后面的Key中值为准。顺序以 `appsetting.json` 中的配置 Listeners 的数组顺序为依据。

### 4.获取配置数据

```csharp
// 方式1
var connectString = _configuration.GetValue<string>("ConnectionStrings:Default");
var redisPwd = _configuration.GetValue<string>("Redis:Password"); 

// 方式2
var password=_configuration["Redis:Password"]; 
// 通过强类型绑定
// 方式3 
var redis = _configuration.GetSection("Redis").Get<RedisConfig>();
```

**选项数据配置**

`Program.cs`

```csharp
 // 选项配置
 context.Services.Configure<RedisConfig>(configuration.GetSection("Redis"));
```

使用：

```csharp
private readonly IOptions<RedisConfig> _redisOptions;
private readonly IOptionsMonitor<RedisConfig> _redisOptionsMonitor;
private readonly IOptionsSnapshot<RedisConfig> _redisOptionsSnapshot;

// 通过构造函数依赖注入
public BookAppService(
  IRepository<Book, Guid> repository,
  IConfiguration configuration,
  IOptions<RedisConfig> redisOptions,
  IOptionsMonitor<RedisConfig> redisOptionsMonitor,
  IOptionsSnapshot<RedisConfig> redisOptionsSnapshot
): base(repository)
{
    _configuration = configuration;
    _redisOptions = redisOptions;
    _redisOptionsMonitor = redisOptionsMonitor;
    _redisOptionsSnapshot = redisOptionsSnapshot;
}

```

```csharp
 string redisStr=JsonConvert.SerializeObject(redis);
 string redisStr2 = JsonConvert.SerializeObject(_redisOptionsMonitor.CurrentValue);
 string redisStr3= JsonConvert.SerializeObject(_redisOptionsSnapshot.Value);

Console.WriteLine($"IOptions:{redisStr}\r\nIOptionsSnapshot:{redisStr3}\r\nIOptionsMonitor:{redisStr2}";)
```

输出：

```json
IOptions:{"Password":"Command_123","Servers":[{"Host":"101.133.132.113","Port":"6379"}]}
IOptionsSnapshot:{"Password":"Command_123","Servers":[{"Host":"101.133.132.113","Port":"6379"}]}
IOptionsMonitor:{"Password":"Command_123","Servers":[{"Host":"101.133.132.113","Port":"6379"}]}
```

在 nacos 配置中心中修改配置后

只有`IOptions<UserInfo>`不会变化，其他是会跟着变化的。

```
IOptions:{"Password":"Command_123","Servers":[{"Host":"101.133.132.113","Port":"6379"}]}
IOptionsSnapshot:{"Password":"Command_123444","Servers":[{"Host":"101.133.132.113","Port":"63791"}]}
IOptionsMonitor:{"Password":"Command_123444","Servers":[{"Host":"101.133.132.113","Port":"63791"}]}
```