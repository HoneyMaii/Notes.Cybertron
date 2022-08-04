---
title: EntityFramework Core
date: 2022-08-04
---
## 基础知识


### 实用
#### 1.EF 输出 SQL 语句
在 `DbContext` 中的 `OnConfiguring` 方法中增加如下代码：
```csharp
optionsBuilder.LogTo(Console.WriteLine, Microsoft.Extensions.Logging.LogLevel.Information);
```
或
```csharp
optionsBuilder.LogTo(Console.WriteLine, Microsoft.Extensions.Logging.LogLevel.Information).EnableSensitiveDataLogging();
```
第一种不会输出参数的值，第二种则会输出参数的值
