## docker volume 挂载目录和文件的问题

本地目录的路径必须是绝对路径，以前使用 `-v` 参数时如果本地目录不存在 Docker 会自动为你创建一个文件夹

Docker-compose可以使用相对路径

```yaml
version: "3.0"
services:  
  incident:
    image: "commandcenter/vcs/gateway:v3.0.02.1234567.ziyang"
    container_name: "commandcenter.vcs.gateway"
    network_mode: "host"
    user: root
    volumes:
      - "/usr/CommandCenter/vcs/gateway/conf/config.xml:/commandcenter/config.xml"
      - "/usr/CommandCenter/vcs/gateway/conf/log4net.config:/commandcenter/log4net.config"
      - "/usr/CommandCenter/log/vcs/gateway:/commandcenter/log"
      - "/etc/localtime:/etc/localtime"
    logging:
      driver: "json-file"
      options:
        max-size: "50M"
        max-file: "10"
    restart: "always"
    deploy:
      resources:
        limits:
          cpus: "0.50"
          memory: 4096M
        reservations:
          cpus: "0.05"
          memory: 500M


```

### 背景介绍

docker volume 可以使我们在启动docker容器时，动态的挂载一些文件（如配置文件）, 以覆盖镜像中原有的文件，但是，挂载一个主机上尚不存在的文件夹或者文件到容器中会怎样呢？

在工作中就遇到了这样的问题，故自己实践了一下，记录实验结果如下：



### 文件夹挂载

docker在文件夹挂载上的行为是统一的，具体表现为：

- 若文件夹不存在，则先创建出文件夹（若为多层文件夹，则递归创建）
- 用host上的文件夹内容覆盖container中的文件夹内容

```bash
docker run -v /path-to-folder/A:/path-to-folder/B test-image
```

详细说明如下：

#### host上文件夹存在，且非空

| host              | container         | mount result                                                 |
| :---------------- | :---------------- | :----------------------------------------------------------- |
| 存在的非空文件夹A | 不存在的文件夹B   | 先在 container 中创建文件夹B，再将A文件夹中的所有文件copy到B中 |
| 存在的非空文件夹A | 存在的非空文件夹B | 先将 container 中文件夹B的原有内容清空，再将A中文件copy到B中 |

> 无论container中的文件夹B是否存在， A都会完全覆盖B的内容

#### host上文件夹存在，但为空

| host            | container         | mount result                   |
| :-------------- | :---------------- | :----------------------------- |
| 存在的空文件夹A | 存在的非空文件夹B | container中文件夹B的内容被清空 |

> container中对应的文件夹内容被清空

#### host上文件夹不存在

| host                | container         | mount result                                            |
| :------------------ | :---------------- | :------------------------------------------------------ |
| 不存在的文件夹A     | 存在的非空文件夹B | 在host上创建文件夹A，container中文件夹B的内容被清空     |
| 不存在的文件夹A/B/C | 存在的非空文件夹B | 在host上创建文件夹A/B/C，container中文件夹B的内容被清空 |

> container中对应的文件夹内容被清空

### 文件挂载

文件挂载与文件夹挂载最大的不同点在于：

- **docker 禁止用主机上不存在的文件挂载到container中已经存在的文件**
- 文件挂载不会对同一文件夹下的其他文件产生任何影响

除此之外， 其覆盖行为与文件夹挂载一致，即：

- 用host上的文件的内容覆盖container中的文件的内容

  ```bash
  docker run -v /path-to-folder/non-existent-config.js:/path-to-folder/config.js test-image # forbidden
  ```



详细说明如下：

#### host上文件不存在

| host                   | container                 | mount result                                                 |
| :--------------------- | :------------------------ | :----------------------------------------------------------- |
| 不存在的文件configA.js | 已经存在的文件congfigB.js | 报错，Are you trying to mount a directory onto a file (or vice-versa)? Check if the specified host path exists and is the expected type. 同时会在host上生成两个空目录 configA.js 和 configB.js, 但是container无法启动 |



#### host上文件存在

| host                 | container               | mount result                                                 |
| :------------------- | :---------------------- | :----------------------------------------------------------- |
| 存在的文件configA.js | 存在的文件congfigB.js   | container中文件名configB.js保持不变,但是文件内容被congfigA.js的内容覆盖了 |
| 存在的文件configA.js | 不存在的文件congfigB.js | container中新建一个文件configB.js，其内容为configA.js的文件内容， configB.js所在文件下的所有其他文件维持不变 |

### 总结

host上文件一定会覆盖container中文件夹

| host         | container                   | mount result                           |
| :----------- | :-------------------------- | :------------------------------------- |
| 不存在的文件 | 已经存在的文件              | 禁止行为                               |
| 存在的文件   | 不存在的文件/已经存在的文件 | 新增/覆盖 （若目录不存在则会创建目录） |
