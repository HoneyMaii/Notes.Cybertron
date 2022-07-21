---
title: '.NetCore'
date: 2022-07-22
---

# ASP.NET Core 使用手册

[[toc]]

## 通用功能

### 1. API 幂等性(Idempotent)

**API的幂等性（Idempotent）**，是指调用某个方法1次或N次对资源产生的影响结果都是相同的。

GET请求默认是[幂等](https://so.csdn.net/so/search?q=幂等&spm=1001.2101.3001.7020)的，因为它只是查询资源，而不会修改资源。

而POST请求默认是不幂等的，多次调用POST方法可能会产生不同的结果，并会创建多个资源。

想象一下，你在扫码支付时，输入金额后点击了2次“确定”按钮，肯定不希望扣2次款。

**幂等性保证了操作只会执行一次。**

#### 1）思路

使用ASP.NET Core过滤器来处理POST请求，检查请求头中的**幂等键（IdempotencyKey）**。

如果在缓存中未检查到`IdempotencyKey`，则真实执行操作并缓存响应数据，否则直接返回缓存的响应数据。

这样，操作只能对资源产生一次影响。

![img](Asp.NET Core.assets/3d72bfc738a64d10f033f98a16198abd.png)

#### 2）实现

##### 2.1 IdempotentAttributeFilter

创建自定义Filter。

使用`OnActionExecuting`方法在执行操作前检查缓存，如有缓存直接返回`context.Result`；

使用`OnResultExecuted`方法在执行操作后缓存响应。

```csharp
using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Distributed;
using Newtonsoft.Json;

namespace FakeXieCheng.API.Filters
{
    public class IdempotentAttributeFilter : IActionFilter, IResultFilter
    {
        private readonly IDistributedCache _distributedCache;
        private bool _isIdempotencyCache; // 幂等键是否在缓存中
        private const string IdempotencyKeyHeaderName = "IdempotencyKey";
        private string _idempotencyKey;

        //  依赖注入
        public IdempotentAttributeFilter(IDistributedCache distributedCache)
        {
            _distributedCache = distributedCache;
        }

        public void OnActionExecuting(ActionExecutingContext context)
        {
            Microsoft.Extensions.Primitives.StringValues idempotencyKeys;
            // 请求头中获取幂等键：IdempotencyKey
            context.HttpContext.Request.Headers.TryGetValue(IdempotencyKeyHeaderName, out idempotencyKeys);
            _idempotencyKey = idempotencyKeys.ToString();

            // 缓存中获取本次请求的幂等键并做判断
            var cacheData = _distributedCache.GetString(GetDistributedCacheKey());
            if (cacheData != null)
            {
                context.Result = JsonConvert.DeserializeObject<ObjectResult>(cacheData);
                _isIdempotencyCache = true;
            }
        }

        public void OnActionExecuted(ActionExecutedContext context)
        {
            //  幂等键已缓存
            if (_isIdempotencyCache) return;

            var contextResult = context.Result;
            var cacheEntryOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = new TimeSpan(24, 0, 0)
            };
            //  设置缓存
            _distributedCache.SetString(GetDistributedCacheKey(), JsonConvert.SerializeObject(contextResult),
                cacheEntryOptions);
        }

        public void OnResultExecuting(ResultExecutingContext context)
        {
        }

        public void OnResultExecuted(ResultExecutedContext context)
        {
        }

        private string GetDistributedCacheKey()
        {
            return $"Idempotency:{_idempotencyKey}";
        }
    }
}
```

##### 2.2 IdempotentAttribute

创建自定义Attribute。

声明了`IdempotentAttribute`的Class或者Method，在运行时会创建`IdempotentAttributeFilter`

```csharp
using System;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Distributed;

namespace FakeXieCheng.API.Filters
{
    public class IdempotentAttribute : Attribute, IFilterFactory
    {
        public IFilterMetadata CreateInstance(IServiceProvider serviceProvider)
        {
            var distributedCache = (IDistributedCache) serviceProvider.GetService(typeof(IDistributedCache));

            var filter = new IdempotentAttributeFilter(distributedCache);
            return filter;
        }

        public bool IsReusable => false;
    }
}
```

#### 3) 使用

为方法加上`Idempotent` Attribute：

```csharp
        [Idempotent]
        public async Task<IActionResult> CreateTouristRoute([FromBody] TouristRouteForCreationDto touristRouteForCreationDto)
```

##### 注册分布式缓存

从上面的原理图我们可以看到，必须增加分布式缓存，用于保存幂等键的值和响应数据。

修改Startup.cs：

```csharp
public void ConfigureServices(IServiceCollection services)
{
    ...
    services.AddDistributedMemoryCache();
}
```

调用 API 时在请求头中使用不同的 IdempotencyKey 执行请求即可。

### 2. ASP.NET Core 数据验证

1. 制定数据检验规则：

   ASP.NET Core 自带了数据验证框架

- 数据注释（Data Annotation）

  

- 实现接口 `IValidatableObject` 配置自定义的数据检验规则

2. 检测数据
   - 使用内建的 `ModelState` 全局变量（键值类型的数据结构）
   - 通过 `ModelState.IsValid` 提取验证结果，如果验证失败 还会提供失败的详细信息
3. 提交错误信息
   - 状态码：400 level，我们可以使用`422 Unprocessable Entity`：请求格式正确，但是由于含有语义错误，无法响应
   - 错误信息：ModelState 会提供

> 实战
>
> 1. 使用属性级别数据验证（使用接口`IValidatableObject`)
>
>    ```csharp
>     public class TouristRouteForCreationDto  :IValidatableObject
>      {
>        [Required(ErrorMessage = "Title 不可为空")]
>        [StringLength(100)]
>        public string Title { get; set; }
>        [Required]
>        [StringLength(1500)]
>        public string Description { get; set; }
>        // 计算方式：原价*折扣
>        public decimal Price { get; set; }
>        public DateTime? DepartureTime { get; set; }
>        public string Features { get; set; } // 卖点
>        public string Fees { get; set; } // 费用
>        public string Notes { get; set; } // 说明
>        public DateTime CreateTime { get; set; }
>        public DateTime? UpdateTime { get; set; }
>        public double? Rating { get; set; } // 评分
>        public string TravelDays { get; set; } // 旅行天数
>        public string TripType { get; set; } // 旅游类型
>        public string DepartureCity { get; set; } // 旅游城市
>        public ICollection<TouristRoutePictureForCreationDto> TouristRoutePictures { get; set; }
>          = new List<TouristRoutePictureForCreationDto>();
>    
>         // 实现 IValidatableObject 接口的 Validate 方法
>        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
>        {
>          if (Title == Description)
>          {
>            yield return new ValidationResult("路线名称必须与路线描述不同",
>              new[] {"TouristRouteForCreationDto"}
>              );
>          }
>        }
>      }
>    ```
>
>    
>
> 2. 使用类级别数据验证
>
>    1. 添加文件`TouristRouteTitleMustBeDifferentFromDescriptionAttribute.cs`
>
>      
>
>    2. 继承`ValidationAttribute`
>
>       ```csharp
>       public class TouristRouteTitleMustBeDifferentFromDescriptionAttribute:ValidationAttribute
>         {
>           /// <summary>
>           /// 重写 IsValid
>           /// </summary>
>           /// <param name="value"></param>
>           /// <param name="validationContext">访问的是类级别的数据</param>
>           /// <returns></returns>
>           protected override ValidationResult IsValid(
>             object value,
>             ValidationContext validationContext)
>           {
>             var touristRouteDto = (TouristRouteForCreationDto)validationContext.ObjectInstance;
>             if (touristRouteDto.Title == touristRouteDto.Description)
>             {
>               return new ValidationResult("路线名称必须与路线描述不同",
>                 new[] { "TouristRouteForCreationDto" }
>               );
>             }
>             return ValidationResult.Success;
>           }
>         }
>       ```
>
>    3. 在`TouristRouteForCreationDto`声明中添加 attribute
>
>       ```csharp
>       [TouristRouteTitleMustBeDifferentFromDescription]
>         public class TouristRouteForCreationDto
>         {
>           [Required(ErrorMessage = "Title 不可为空")]
>           [StringLength(100)]
>           public string Title { get; set; }
>           [Required]
>           [StringLength(1500)]
>           public string Description { get; set; }
>           // 计算方式：原价*折扣
>           public decimal Price { get; set; }
>           public DateTime? DepartureTime { get; set; }
>           public string Features { get; set; } // 卖点
>           public string Fees { get; set; } // 费用
>           public string Notes { get; set; } // 说明
>           public DateTime CreateTime { get; set; }
>           public DateTime? UpdateTime { get; set; }
>           public double? Rating { get; set; } // 评分
>           public string TravelDays { get; set; } // 旅行天数
>           public string TripType { get; set; } // 旅游类型
>           public string DepartureCity { get; set; } // 旅游城市
>           public ICollection<TouristRoutePictureForCreationDto> TouristRoutePictures { get; set; }
>             = new List<TouristRoutePictureForCreationDto>();
>         }
>       ```
>
>    4. 测试
>
>       
>
> 3. 还有一个问题：返回码还是400，之前我们说了这里最好返回 422 Unprocessable Entity，配置如下：
>
>    1. `Startup.cs` 中 `ConfigureServices`添加服务`ConfigureApiBehaviorOptions`：**非法模型状态响应工厂**
>
>       ```csharp
>       services.AddControllers(setupAction =>
>             {
>               setupAction.ReturnHttpNotAcceptable = true; // 开启请求Header 请求类型处理
>               // setupAction.OutputFormatters.Add(new XmlDataContractSerializerOutputFormatter());
>             }).AddXmlDataContractSerializerFormatters() // 支持返回 xml 格式
>       
>               .ConfigureApiBehaviorOptions(setupAction => // 控制API controller 行为的服务：非法模型状态响应工厂
>               {
>                 setupAction.InvalidModelStateResponseFactory = context =>
>                 {
>                   var problemDetail = new ValidationProblemDetails(context.ModelState)
>                   {
>                     Type = "无所谓",
>                     Title = "数据验证失败",
>                     Status = StatusCodes.Status422UnprocessableEntity,
>                     Detail = "请看详细说明",
>                     Instance = context.HttpContext.Request.Path
>                   };
>                   problemDetail.Extensions.Add("traceId", context.HttpContext.TraceIdentifier); // 增加追踪 id
>                   return new UnprocessableEntityObjectResult(problemDetail)
>                   {
>                     ContentTypes = {"application/problem+json"} // 配置响应的媒体类型，方便前段解析
>                   };
>                 };
>       
>               }) 
>               ; 
>       ```
>
>    2. 测试 api：
>
>       

### 3. 管理 URL 配置：UrlHelper 组件

> 函数 link 可以生成 URL路径，ASP Net Core 需要依赖注入到服务中

1. `Startup.cs/ConfigureServices`:

```csharp
 						// UrlHelper 组件
            services.AddSingleton<IActionContextAccessor, ActionContextAccessor>();
```

2. API 的构造函数中注入：

```csharp
				private readonly IUrlHelper _urlHelper;

        public TouristRoutesController(
            IUrlHelperFactory urlHelperFactory,
            IActionContextAccessor actionContextAccessor
        )
        {           
            _urlHelper = urlHelperFactory.GetUrlHelper(actionContextAccessor.ActionContext);
        }
```

3. Url 生成器

```csharp
				// Url生成器：生成上/下一页 路径信息
        private string GenerateTouristRouteResourceUrl(
            TouristRouteParameters parameters,
            PaginationResourceParameters pageParameters,
            ResourceUriType type
        )
        {
            return type switch
            {
               ResourceUriType.PreviousPage => _urlHelper.Link("GetTouristRoutes", new
                {
                    fields = parameters.Fields,
                    orderBy = parameters.OrderBy,
                    keyword = parameters.Keyword,
                    rating = parameters.Rating,
                    pageNumber = pageParameters.PageNumber - 1,
                    pageSize = pageParameters.PageSize
                }),
                ResourceUriType.NextPage => _urlHelper.Link("GetTouristRoutes", new
                {
                    fields = parameters.Fields,
                    orderBy = parameters.OrderBy,
                    keyword = parameters.Keyword,
                    rating = parameters.Rating,
                    pageNumber = pageParameters.PageNumber + 1,
                    pageSize = pageParameters.PageSize
                }),
                // 默认页
                _ => _urlHelper.Link("GetTouristRoutes", new
                {
                    fields = parameters.Fields,
                    orderBy = parameters.OrderBy,
                    keyword = parameters.Keyword,
                    rating = parameters.Rating,
                    pageNumber = pageParameters.PageNumber,
                    pageSize = pageParameters.PageSize
                })
            };
        }

        [HttpGet(Name = "GetTouristRoutes")]
        [HttpHead]
        public async Task<IActionResult> GetTouristRoutes([FromQuery] TouristRouteParameters parameters,
            [FromQuery] PaginationResourceParameters pageParameters)
        {
             if (!_propertyMappingService.IsMappingExists<TouristRouteDto, TouristRoute>(parameters.OrderBy))
                return BadRequest("请输入正确的排序参数");
            if (!_propertyMappingService.IsPropertiesExists<TouristRoute>(parameters.Fields))
                return BadRequest("请输入正确的塑形参数");
            var touristRoutesFromRepo = await _touristRouteRepository.GetTouristRoutesAsync(
                parameters.Keyword,
                parameters.RatingOperator,
                parameters.RatingValue,
                pageParameters.PageSize,
                pageParameters.PageNumber,
                parameters.OrderBy
            );
            if (touristRoutesFromRepo?.Count <= 0) return NotFound("没有旅游路线");
            var touristRoutesDto = _mapper.Map<IEnumerable<TouristRouteDto>>(touristRoutesFromRepo);
						// 上一页 link          
            var previousPageLink = touristRoutesFromRepo.HasPrevious
                ? GenerateTouristRouteResourceUrl(
                    parameters, pageParameters, ResourceUriType.PreviousPage)
                : null;
          // 下一页 link
            var nextPageLink = touristRoutesFromRepo.HasNext
                ? GenerateTouristRouteResourceUrl(
                    parameters, pageParameters, ResourceUriType.NextPage
                )
                : null;

            // x-pagination
            var paginationMetadata = new
            {
                previousPageLink,
                nextPageLink,
                totalCount = touristRoutesFromRepo.TotalCount,
                pageSize = touristRoutesFromRepo.PageSize,
                currentPage = touristRoutesFromRepo.CurrentPage,
                totalPages = touristRoutesFromRepo.TotalPages
            };
            Response.Headers.Add("x-pagination", Newtonsoft.Json.JsonConvert.SerializeObject(paginationMetadata));

            return Ok(touristRoutesDto.ShapeData(parameters.Fields));
        }
```

4. API 测试：

响应的 Header 中添加了 `x-pagination` 可以使得API自我发现上/下一页 信息



### 4.NET Core 使用字符串进行数据排序

> **属性（Property）映射服务**
>
> - 避免写死排序的代码
> - 自由的实现升序与降序排列数据的功能
> - 实现排序组件的重复性使用

1. 项目引入 `System.Linq.Dynamic.Core` 包

2. 封装一个 IQuerable 拓展包实现可以根据字符串（e.g. "rating desc, originalPrice desc"）进行排序

   - 2.1.  创建属性映射服务 `PropertyMappingService`

     ```csharp
     using System;
     using System.Collections.Generic;
     using System.Linq;
     using FakeXieCheng.API.Dtos;
     using FakeXieCheng.Models;
     
     namespace FakeXieCheng.API.Services
     {
         public class PropertyMappingService : IPropertyMappingService
         {
             // 属性映射列表
             private Dictionary<string, PropertyMappingValue> _touristRoutePropertyMapping =
                 new Dictionary<string, PropertyMappingValue>(StringComparer.OrdinalIgnoreCase)
                 {
                     {"Id", new PropertyMappingValue(new List<string>() {"Id"})},
                     {"Title", new PropertyMappingValue(new List<string>() {"Title"})},
                     {"Rating", new PropertyMappingValue(new List<string>() {"Rating"})},
                     {"OriginalPrice", new PropertyMappingValue(new List<string>() {"OriginalPrice"})},
                 };
     
             // 包含 DTO 中字段与字符串名称的对应关系，然后映射给 Model
             private IList<IPropertyMapping> _propertyMappings = new List<IPropertyMapping>();
     
             // 构造函数
             public PropertyMappingService()
             {
                 _propertyMappings.Add(
                     new PropertyMapping<TouristRouteDto, TouristRoute>(_touristRoutePropertyMapping)
                 );
             }
     
             // sting:字段字符串名称
             // PropertyMappingValue：目标模型的属性
             // 泛型定义
             public Dictionary<string, PropertyMappingValue> GetPropertyMapping<TSource, TDestination>()
             {
                 // 获得匹配的映射对象
                 var matchingMapping =
                     _propertyMappings
                         .OfType<PropertyMapping<TSource, TDestination>>(); // 通过在IPropertyMapping 列表中传入数据源类型来匹配映射对象
                 if (matchingMapping.Count() == 1) return matchingMapping.First()._mappingDictionary;
                 throw new Exception(
                     $"Cannot find exact property mapping instance for <{typeof(TSource)},{typeof(TDestination)}>");
             }
     
             public bool IsMappingExists<TSource, TDestination>(string fields)
             {
                 var propertyMapping = GetPropertyMapping<TSource, TDestination>();
                 if (string.IsNullOrWhiteSpace(fields)) return true;
     
                 // 逗号来分隔字段字符串
                 var fieldAfterSplit = fields.Split(',');
                 foreach (var field in fieldAfterSplit)
                 {
                     // 去掉空格
                     var trimmedField = field.Trim();
                     // 获得属性名称字符串
                     var indexOfFirstSpace = trimmedField.IndexOf(" ", StringComparison.Ordinal);
                     var propertyName = indexOfFirstSpace == -1 ? trimmedField : trimmedField.Remove(indexOfFirstSpace);
                     if (!propertyMapping.ContainsKey(propertyName)) return false;
                 }
     
                 return true;
             }
         }
     }
     ```

   - 2.2. PropertyMappingValue.cs:

     ```csharp
     using System.Collections.Generic;
     
     namespace FakeXieCheng.API.Services
     {
         public class PropertyMappingValue
         {
             public IEnumerable<string> DestinationProperties { get; set; } // 将会被映射的目标类型属性
     
             // 构造函数
             public PropertyMappingValue(IEnumerable<string> destinationProperties)
             {
                 DestinationProperties = destinationProperties;
             }
         }
     }
     ```

   - 2.3 PropertyMapping.cs

     ```csharp
     using System.Collections.Generic;
     
     namespace FakeXieCheng.API.Services
     {
         // 新建类型用来保存 Diction<string,PropertyMappingValue> 类型的的值
         public class PropertyMapping<TSource, TDestination> : IPropertyMapping
         {
             public Dictionary<string, PropertyMappingValue> _mappingDictionary { get; set; }
     
             public PropertyMapping(Dictionary<string, PropertyMappingValue> mappingDictionary)
             {
                 _mappingDictionary = mappingDictionary;
             }
         }
     }
     ```

   - 2.4 IPropertyMapping.cs 和 IPropertyMappingService.cs

     ```csharp
     // IPropertyMapping.cs
     namespace FakeXieCheng.API.Services
     {
         public interface IPropertyMapping
         {
             
         }
     }
     
     // IPropertyMappingService.cs
     using System.Collections.Generic;
     
     namespace FakeXieCheng.API.Services
     {
         public interface IPropertyMappingService
         {
             Dictionary<string, PropertyMappingValue> GetPropertyMapping<TSource, TDestination>();
             bool IsMappingExists<TSource, TDestination>(string fields);
         }
     }
     ```

   - 2.5 IQueryableExtensions.cs ( IQueryable 拓展)

     ```csharp
     using System;
     using System.Collections.Generic;
     using System.Linq;
     using System.Linq.Dynamic.Core;
     using FakeXieCheng.API.Services;
     
     namespace FakeXieCheng.API.Helper
     {
         public static class IQueryableExtensions
         {
             public static IQueryable<T> ApplySort<T>(
                 this IQueryable<T> source,
                 string orderBy,
                 Dictionary<string, PropertyMappingValue> mappingDictionary
             )
             {
                 // source 合法性检验
                 if (source == null)
                 {
                     throw new ArgumentNullException(nameof(source));
                 }
     
                 // 映射字符串检验
                 if (mappingDictionary == null)
                 {
                     throw new ArgumentNullException(nameof(mappingDictionary));
                 }
     
                 if (string.IsNullOrWhiteSpace(orderBy))
                 {
                     return source;
                 }
     
                 var orderByString = string.Empty; // 后面排序时使用，生成 sql 代码
                 var orderAfterSplit = orderBy.Split(',');
                 foreach (var order in orderAfterSplit)
                 {
                     var trimmedOrder = order.Trim();
                     // 通过字符串 "desc" 来判断升序还是降序
                     var orderDescending = trimmedOrder.EndsWith(" desc");
     
                     // 删除升序或降序字符串 "asc" 或 "desc" 来获取属性的名称
                     var indexOfFirstSpace = trimmedOrder.IndexOf(" ", StringComparison.Ordinal);
                     var propertyName = indexOfFirstSpace == -1 ? trimmedOrder : trimmedOrder.Remove(indexOfFirstSpace);
                     if (!mappingDictionary.ContainsKey(propertyName))
                         throw new ArgumentException($"Key mapping for {propertyName} is missing.");
     
                     var propertyMappingValue = mappingDictionary[propertyName];
                     if (propertyMappingValue == null) throw new ArgumentNullException(nameof(propertyMappingValue));
                     
                     // 使用 dynamic.linq 执行排序操作
                     foreach (var destinationProperty in propertyMappingValue.DestinationProperties.Reverse())
                     {
                         // 给 IQueryable 添加排序字符串
                         orderByString = orderByString +
                                         (string.IsNullOrWhiteSpace(orderByString) ? string.Empty : ", ")
                                         + destinationProperty
                                         + (orderDescending ? " descending" : " ascending");
                     }
                 }
                 return source.OrderBy(orderByString);
             }
         }
     }
     ```

     

### 5. ASP .NET Core  添加自定义媒体类型

#### 5.1 全局添加：

`Startup.cs/ConfigureServices`添加服务配置：

```csharp
						// 添加自定义媒体类型格式处理器
            services.Configure<MvcOptions>(config =>
            {
                var outputFormatter = config.OutputFormatters.OfType<NewtonsoftJsonOutputFormatter>															()?.FirstOrDefault();
                if (outputFormatter != null)
                {
                  	// 添加自定义的媒体类型 “application/vnd.eddy.hateoas+json”
                    outputFormatter.SupportedMediaTypes.Add("application/vnd.eddy.hateoas+json");
                }
            });
```

#### 5.2 特殊Controller 或 Action 添加：	

```csharp
// 为整个控制器添加 
[Route("api/[controller]")]
 [ApiController]
 [Produces(
            "application/json",
            "application/vnd.eddy.hateoas+json"
        )]
public class TouristRoutesController : ControllerBase
{
}

// 为单个 Action 添加
[Produces(
            "application/json",
            "application/vnd.eddy.hateoas+json"
        )]
[HttpGet(Name = "GetTouristRoutes")]
[HttpHead]
public async Task<IActionResult> GetTouristRoutes(
            [FromQuery] TouristRouteParameters parameters,
            [FromQuery] PaginationResourceParameters pageParameters,
            [FromHeader(Name = "Accept")] string mediaType
        )
 {
 }
```

### 6. 添加 json patch 支持

#### 6.1 添加package：

nuget 添加包 ` Microsoft.AspNetCore.JsonPatch`

#### 6.2 API 代码

```csharp
				[HttpPatch("{touristRouteId}", Name = "PartiallyUpdateTouristRoute")]
        [Authorize(AuthenticationSchemes = "Bearer")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> PartiallyUpdateTouristRoute(
            [FromRoute] Guid touristRouteId,
            [FromBody] JsonPatchDocument<TouristRouteForUpdateDto> patchDocument)
        {
            if (!await _touristRouteRepository.TouristRouteExistsAsync(touristRouteId)) return NotFound("旅游路线找不到");
            var touristRouteFromRepo = await _touristRouteRepository.GetTouristRouteAsync(touristRouteId);
            var touristRouteToPatch = _mapper.Map<TouristRouteForUpdateDto>(touristRouteFromRepo);
          
            // JsonPatch 无法进行数据验证，因为数据验证是 JsonPatchDocument 类型
            // 之前的TouristRouteForUpdateDto验证失效
            // 下面利用 ModelState 和 TryValidateModel 进行更新前数据验证
            patchDocument.ApplyTo(touristRouteToPatch, ModelState);
            if (!TryValidateModel(touristRouteToPatch)) return ValidationProblem(ModelState);
          
            _mapper.Map(touristRouteToPatch, touristRouteFromRepo);
            await _touristRouteRepository.SaveAsync();
            return NoContent();
        }
```

#### 6.3 测试





### 7. EntityFramework Core Tools

Entity Framework Core 的包管理器控制台 (PMC) 工具执行设计时开发任务。 例如，可以创建[迁移](https://docs.microsoft.com/zh-CN/aspnet/core/data/ef-mvc/migrations)、应用迁移，并为基于现有数据库的模型生成代码。

#### 安装工具

在“包管理器控制台”中运行以下命令，安装包管理器控制台工具：

```powershell
Install-Package Microsoft.EntityFrameworkCore.Tools
```

在“包管理器控制台”中运行以下命令来更新工具。

```powershell
Update-Package Microsoft.EntityFrameworkCore.Tools
```

#### 验证安装

```powershell
Get-Help about_EntityFrameworkCore
```

输出如下所示

```powershell
Get-Help about_EntityFrameworkCore

                     _/\__
               ---==/    \\
         ___  ___   |.    \|\
        | __|| __|  |  )   \\\
        | _| | _|   \_/ |  //|\\
        |___||_|       /   \\\/\\

TOPIC
    about_EntityFrameworkCore

SHORT DESCRIPTION
    Provides information about the Entity Framework Core Package Manager Console Tools.

LONG DESCRIPTION
    This topic describes the Entity Framework Core Package Manager Console Tools. See https://docs.efproject.net for
    information on Entity Framework Core.

    The following Entity Framework Core commands are available.

        Cmdlet                      Description
        --------------------------  ---------------------------------------------------
        Add-Migration               Adds a new migration.

        Bundle-Migration            Creates an executable to update the database.

        Drop-Database               Drops the database.

        Get-DbContext               Lists and gets information about available DbContext types.

        Get-Migration               Lists available migrations.

        Optimize-DbContext          Generates a compiled version of the model used by the DbContext.

        Remove-Migration            Removes the last migration.

        Scaffold-DbContext          Scaffolds a DbContext and entity types for a database.

        Script-DbContext            Generates a SQL script from the DbContext. Bypasses any migrations.

        Script-Migration            Generates a SQL script from migrations.

        Update-Database             Updates the database to a specified migration.

```

#### Scaffold-DbContext

为 `DbContext` 生成代码，并为数据库生成实体类型。 为了让 `Scaffold-DbContext` 生成实体类型，数据库表必须具有主键。

示例

```powershell
Scaffold-Dbcontext "Data Source=192.168.31.212;Persist Security Info=True;User ID=sa;Password=Master123$%^" Microsoft.EntityFrameworkCore.SqlServer -OutputDir Models -Context AppDbConttext
```

参数：

| 参数                         | 说明                                                         |
| :--------------------------- | :----------------------------------------------------------- |
| `-Connection <String>`       | 用于连接到数据库的连接字符串。 对于 ASP.NET Core 2.x 项目，值可以是*name = < 连接字符串 > 的名称*。 在这种情况下，名称来自为项目设置的配置源。 这是一个位置参数，并且是必需的。 |
| `-Provider <String>`         | 要使用的提供程序。 通常，这是 NuGet 包的名称，例如：`Microsoft.EntityFrameworkCore.SqlServer`。 这是一个位置参数，并且是必需的。 |
| `-OutputDir <String>`        | 要在其中放置实体类文件的目录。 路径相对于项目目录。          |
| `-ContextDir <String>`       | 要在其中放置 `DbContext` 文件的目录。 路径相对于项目目录。   |
| `-Namespace <String>`        | 要用于所有生成的类的命名空间。 默认设置为从根命名空间和输出目录生成。 已在 EF Core 5.0 中添加。 |
| `-ContextNamespace <String>` | 要用于生成的 `DbContext` 类的命名空间。 注意：重写 `-Namespace`。 已在 EF Core 5.0 中添加。 |
| `-Context <String>`          | 要生成的 `DbContext` 类的名称。                              |
| `-Schemas <String[]>`        | 要为其生成实体类型的表的架构。 如果省略此参数，则包含所有架构。 |
| `-Tables <String[]>`         | 要为其生成实体类型的表。 如果省略此参数，则包含所有表。      |
| `-DataAnnotations`           | 使用属性配置模型（如果可能）。 如果省略此参数，则仅使用 Fluent API。 |
| `-UseDatabaseNames`          | 使用与数据库中显示的名称完全相同的表和列名。 如果省略此参数，数据库名称将更改为更符合 csharp 名称样式约定。 |
| `-Force`                     | 覆盖现有文件。                                               |
| `-NoOnConfiguring`           | 不生成 `DbContext.OnConfiguring`。 已在 EF Core 5.0 中添加。 |
| `-NoPluralize`               | 请勿使用复数化程序。 已在 EF Core 5.0 中添加。               |

### 8. ASP.NET Core中singleton生命周期的服务如何注入Scoped服务?

假设有两个服务，Student 和 Major，其中 Student 服务的生命周期注入为 Singleton，Major 服务的生命周期注入为 Scoped。

```csharp
builder.Services.AddSingleton<Student>();
builder.Services.AddScoped<Major>();
```

其中 Student 服务中依赖 Major：

```csharp
class Student
{
  private readonly Major _major;
  public Student(Major major)
  {
    _major = major;
  }
}
```

此时运行项目，报错 `System.AggregateException`。

因为 Singleton 单例生命周期的服务里依赖 Scoped 范围生命周期的服务是会报错的，

解决方式一：

使用 `IServiceScopeFactory`

```csharp
public calss Student
{
  private readonly Major _major;
  private readonly IServiceScopeFactory _serviceScopeFactory;
  public Student(IServiceScopeFactory serviceScopeFactory)
  {
    _serviceScopeFactory = serviceScopeFactory;
    _major = _serviceScopeFactory.CreateScope().ServiceProvider.GetRequiredService<Major>();
  }
}
```

解决方式二：

使用 `IServiceProvider` 

```csharp
public Student(IServiceProvider provider)
{
  _major = provider.CreateScope().ServiceProvider.GetRequiredService<Major>();
}
```



## 理论基础

### 1.依赖注入

#### 1.1 为什么要使用依赖注入框架

1. 借助依赖注入框架，可以轻松管理类之间的依赖，帮助我们在构建应用时遵循依赖倒置原则，确保代码的可维护性和可扩展性。
2. ASP.NET Core整个架构中，依赖注入框架提供了对象创建和生命周期管理的核心能力，各个组件相互协作，也是由依赖注入框架的能力来实现的。

#### 1.2 核心类型

- `IServiceCollection`:负责服务的注册
- `ServiceDescriptor`：每一个服务注册时的信息
- `IServiceProvider`：具体的容器，由ServiceCollection.Build 出来的
- `IServiceScope`：表示一个容器的字容器的生命周期

#### 1.3 生命周期：ServiceLifetime

- 单例`Singleton`

  在整个根容器类的生命周期内都是单例，不管是字容器还是根容器。

  与Scoped 的区别是一个是全局的单例，一个是范围的单例。

- 作用域`Scoped`

  Scoped生存周期内，如果容器释放掉那就意味着我的对象也会释放掉，在范围内得到的是一个单例模式。

- 瞬时（暂时）`Transient`

  每一次从容器里获取对象时，都可以获得一个新的对象。

##### Show code

**注册不同生命周期的服务**

```csharp
services.AddSingleton<IMySingletonService,MySingletonService>();
services.AddScoped<IMyScopedService, MyScopedService>();
service.AddTransient<IMyTransientService, MyTransientService>();
```

**花式注册**

```csharp
services.AddSingleton<IOrderService>(new OrderService()); // 直接注入实例

services.AddSingleton<IOrderService>(serviceProvider=>{  // 使用工厂方式注入
  
  ... 													// 工厂模式可以从容器中获取多个对象进行改造组装，返回复杂的对象。
    														// 或者实现类依赖容器内另外一个类
    														// 或者期望用另一个类包装原有实现时
  return new OrderServiceEx();
});
```

**尝试注册**

```csharp
services.TryAddSingleton<IOrderService,OrderServiceEx>(); // 服务类型(接口)如果之前有注册，则不会注册。如果之前没有注册则进行注册

services.TryAddEnumerable(ServiceDescriptor.Singleton<IOrderService, OrderService>()); // 相同类型的服务接口如果实现是不同的则可以注册进去，如果相同则无法注册
```

**移除和替换注册**

```csharp
services.Replace(ServiceDescriptor.Singleton<IOrderService, OrderServiceEx>()); // 替换掉服务注册的第一个实现
services.RemoveAll(IOrderService); // 移除掉所有服务注册
```

**注册泛型模板**

```csharp
services.AddSingleton(typeof(IMyGenericService<>),typeof(MyGenericService<>)); // 可以把泛型模板注册进去，将所有此泛型具体实现注入进来
// 不能用泛型API注入进去，只能用泛型类型注入
```

#### 1.4 注入方式

1. 构造函数注入

   服务是大部分接口都使用的情况下，推荐使用构造函数注入

   ```csharp
   private IOrderService _orderService;
   public Constructor(IOrderService orderService){
     _orderService = orderService;
   }
   ```

2. `FromServices`

   服务只有一个特定接口使用的情况下，推荐使用

   ```csharp
   [HttpGet]
   public IActionResult Getxxxx([FromServices] IOrderService orderService){
     ...
   }
   ```

#### 1.5 作用域

- `IServiceScope`

  作用域主要是由 IServiceScope 这个接口来承载的

##### 实现 `IDisposable`接口类型的释放

- DI 只负责释放由其创建的对象实例
- DI 在容器或子容器释放时，释放由其创建的对象实例

##### 建议

- 避免在根容器获取实现了`IDisposable`接口的瞬时服务
- 避免手动创建实现了`IDisposable` 对象，应该使用容器来管理其生命周期

```csharp
services.AddSingleton<IOrderService>(serviceProvider => new DisposableOrderService()); // DI 会帮我们释放对象实例

var service = new DisposableOrderService();
services.AddSingleton<IOrderService>(service); // 这种方式 DI 则不会负责管理生命周期
```

> 注册服务实现 IDisposable 的坑：
>
> 如果服务是瞬时（transient）的,又在根容器中去做操作，它会一直保持到应用程序退出时才会被回收掉。
>
> ```csharp
> // Startup.cs/ConfigureServices()
> ...
> services.AddTransient<IOrderService,DisposableOrderService>();
> 
> // Stratup.cs/Configure()
> 
> // 从根容器获取瞬时服务
> // 下面2个对象会一直保持到整个应用程序退出时才会被回收 ！！！
> var service = app.ApplicationServices.GetService<IOrderService>(); 
> var service2 = app.ApplicationServices.GetService<IOrderService>();
> ```

### 2.使用第三方框架增强容器能力

> 什么情况下需要引入第三方容器组件
>
> - 基于名称的注入
> - 属性注入
> - 子容器
> - 基于动态代理的AOP

.NET Core核心扩展点是

```csharp
public interface IServiceProviderFactory<TContainerBuiler>
```

第三方的依赖注入容器都是使用这个类作为扩展点，把自己注入到系统内。

#### 使用 AutoFac 第三方容器

- Nuget引入package：`AutoFac.Extensions.DependencyInjection`和`AutoFac.Extras.DynamicProxy`

  使用这2个包就可以实现上面提到的4中能力

- 代码调整

  1. `Program.cs`:

     ```csharp
     public static IHostBuilder CreateHostBuilder(string[] args) =>
                 Host.CreateDefaultBuilder(args)
                     .ConfigureAppConfiguration((context, config) =>
                     {
                         config.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
                     })
                     .UseServiceProviderFactory(new AutofacServiceProviderFactory()) // 使用AutoFac
                     .ConfigureWebHostDefaults(webBuilder => { webBuilder.UseStartup<Startup>(); });
     ```

  2. `Startup.cs`

     ```csharp
       			// for AutoFac
             public void ConfigureContainer(ContainerBuilder builder)
             {
                 builder.RegisterType<MyService>().As<IMyService>();
     
                 #region 命名注册
                 builder.RegisterType<MyServiceV2>().Named<IMyservice>("service2");
                 #endregion
     
                 #region 属性注册
                 builder.RegisterType<MyServiceV2>().As<IMyService>().PropertiesAutowired();
                 #endregion
     
                 #region AOP 不改变原有类的前提上，改变方法的逻辑
                   // MyInterceptor 实现 IInterceptor 接口
                 builder.RegisterType<MyInterceptor>(); // 将拦截器注册到容器中
                 builder.RegisterType<MyNameService>();
                 builder.RegisterType<MyServiceV2>().As<IMyService>().PropertiesAutowired()
                     .InterceptedBy(typeof(MyInterceptor)).EnableInterfaceInterceptors(); // 使用 InterceptedBy 将类型注入进来，允许接口拦截器
               // 拦截器有2种：接口拦截器 和 类拦截器（需要将类设置为virtual）
                 #endregion
     
                 #region 子容器
     						builder.RegisterType<MyNameService>().InstancePerMatchingLifetimeScope("myscope"); // 把服务注入到特定名字的子容器中
                 #endregion
             }
     ```

     ```csharp
     public class MyInterceptor : IInterceptor
     {
       public void Intercept(IInvocation invocation){
         // 拦截前 do something
         invocation.Proceed();  // 执行方法体逻辑
         // 拦截后 do something
       }
     } 
     ```

     

  3. 使用

     ```csharp
     public ILifetimeScope AutofacContainer{get; private set;}
     
     public void Configure(IApplicationBuilder app, IWebHostEnvironment env){
       AutofacContainer = app.ApplicationServices.GetAutofacRoot();
       
       var serviceName=AutofacContainer.Resolve<IMyService>(); 
       
       var service = AutofacContainer.ResolveNamed<IMyService>("service2"); // 获取命名注册
       
       #region 子容器
        
        using(var myscoped=AutofacContainer.BeginLifetimeScope("myscope"))
       {
        		var service0=myscoped.Resolve<MyNameService>();
         	using(var scope = myscoped.BeginLifetimeScope())
           {
             	var service1 = scope.Resolve<MyNameService>();
               var service2 = scope.Resolve<MyNameService>();
             	Console.WriteLine($"service1=service2:{service1 == service2}");
             	Console.WriteLine($"service1=service0:{service1 == service0}");
           }
       }
         // 输出结果：
       	/*
       		service1=service2:True
       		service1=service0:True
       	*/
       #endregion
     }
     ```

     

### 3. 配置框架

#### 3.1 核心组件包

- `Microsoft.Extensions.Configuration.Abstractions`
- `Microsoft.Extensions.Configuration`

接口实现分离设计模式

#### 3.2 配置框架

- 以 key-value 字符串键值对的方式抽象了配置
- 支持从各种不同的数据源读取配置（命令行、文件、配置文件等）

#### 3.3 核心类型

- `IConfiguration`
- `IConfigurationRoot`
- `IConfigurationSection`
- `IConfigurationBuilder`

#### 3.4 扩展点

- `IConfigurationSource`
- `IConfigurationProvider`

#### 3.5 Code

```csharp
						IConfigurationBuilder builder = new ConfigurationBuilder(); // IConfigurationBuilder 是配置框架的核心
            builder.AddInMemoryCollection(new Dictionary<string, string>()
            {
                {"key1","value1"},
                {"key2","value2"},
                {"section1:key4","value4"},
                {"section2:section3:key5","value5"}, //  配置多个节点
            });

            IConfigurationRoot configurationRoot = builder.Build(); // 把所有配置构建起来获得 root
            IConfiguration config = configurationRoot;
            Console.WriteLine(configurationRoot["key1"]);

            IConfigurationSection section = config.GetSection("section1"); // 获取节点
            Console.WriteLine($"section1-key4:{section["key4"]}");

            IConfigurationSection section2 = config.GetSection("section2");
            var section3 = section2.GetSection("section3");
            Console.WriteLine($"section2-section3-key5:{section3["key5"]}");

						// Output：
            // value1
						// value2
						// section1-key4:value4
						// section2-section3-key5:value5
```

#### 3.6 几种配置方式

##### 1. 命令行参数做配置数据源

支持的命令方式：

- 无前缀的 `key = value` 模式
- 双中横线模式 `--key = value` 或 `--key value`
- 正斜杠模式 `/key = value` 或 `/key value`

备注： 等号分隔符和空格分隔符不能混用

**命令替换模式**

- 必须以单下划线`_`或双横线`--`开头
- 映射字典不能包含重复 key

`/Properties/launchSettings.json`

```json
"profiles":{
  "FakeXiecheng": {
      "commandName": "Project",
    	"commandLineArgs":"CommandLineKey1=value1 --CommandLineKey2=value2 /CommandLineKey3=value3 -k1=k3"
}
```

`Program.cs`

```csharp
public static void Main(string[] args)
{
  					IConfigurationBuilder builder = new ConfigurationBuilder(); // IConfigurationBuilder 是配置框架的核心

            // builder.AddCommandLine(args);

            #region 命令替换

            var mapper = new Dictionary<string, string>
            {
                {"-k1","CommandLineKey1"}
            };
            builder.AddCommandLine(args, mapper);

            #endregion

            var configurationRoot = builder.Build();
            Console.WriteLine($"CommandLineKey1:{configurationRoot["CommandLineKey1"]}");
            Console.WriteLine($"CommandLineKey2:{configurationRoot["CommandLineKey2"]}");
}
```

##### 2. 环境变量做配置源

**适用场景**

- 在 Docker 中运行
- 在 Kubernetes 中运行
- 需要设置 ASP.NET Core 的一些内置特殊配置时

**特性**

- 对于配置的分层键，支持用双下划线`__`代替`:`
- 支持根据前缀加载

**代码**

在`/Properties/launchSettings.json`增加环境变量配置：

```csharp
"environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "KEY1": "value1",
        "KEY2": "value2",
        "SECTION1__KEY3": "value3",
        "Section1__SECTION2__KEY4": "value4",
        "EDWARD_KEY1":"edward key1"
      }
```

`Program.cs`

```csharp
    public static void Main(string[] args)
    {
   					var builder = new ConfigurationBuilder();
            builder.AddEnvironmentVariables();

             var configurationRoot = builder.Build();
             Console.WriteLine($"key1:{configurationRoot["key1"]}");

            #region 分层键

            var section = configurationRoot.GetSection("SECTION1");
            Console.WriteLine($"KEY3:{section["KEY3"]}");
            
            var section2= configurationRoot.GetSection("SECTION1:SECTION2");
            Console.WriteLine($"KEY4:{section2["KEY4"]}");

            #endregion

		}
// Output:
/*
	key1:value1
	KEY3:value3
	KEY4:value4
*/
```

```csharp
		public static void Main(string[] args)
    {
      // 前缀过滤
      #region 前缀过滤
      // 需要加载特定值，去掉系统其他值干扰性时，使用前缀过滤

      builder.AddEnvironmentVariables("EDWARD_");
      var configurationRoot = builder.Build();
      Console.WriteLine($"key1:{configurationRoot["key1"]}");

      #endregion

    }

/* Output：
	 key1:edward key1
*/
```

##### 3. 文件配置提供程序

- Microsoft.Extensions.Configuration.Ini
- Microsoft.Extensions.Configuration.Json
- Microsoft.Extensions.Configuration.NewtonsoftJson
- Microsoft.Extensions.Configuration.Xml
- Microsoft.Extensions.Configuration.UserSecrets

从不同的位置读取文件



**特性**

- 指定文件可选、必选
- 指定是否监视文件的变更

**代码**

`Program.cs`

```csharp
      public static void Main(string[] args)
      {
  					var builder = new ConfigurationBuilder();
            // optional 表示文件不存在时是否报错，true不报错，false报错
            // reloadOnChange 文件内容变化是否重新加载
            builder.AddJsonFile("appsettings.json",optional:false,reloadOnChange:true);
            builder.AddIniFile("appsettings.ini"); // 后添加的配置优先级更高
            var configurationRoot = builder.Build();
            Console.WriteLine($"Authentication:{configurationRoot["Key3"]}");
			}
//Output
//Authentication:Value3 in ini
```

#### 3.7 通过代码配置变更监听

> **场景**
>
> - 需要记录配置源的变更时
> - 需要在配置数据变更时出发特定操作时

**关键方法**

`IChangeToken IConfiguration.GetReloadToken()`

**代码**

```csharp
			public static void Main(string[] args)
      {
        var builder = new ConfigurationBuilder();
        builder.AddJsonFile("appsettings.json");
        
        var configurationRoot = config.Build();
        IChangeToken token = configurationRoot.GetReloadToken();
        // 注册配置文件发生变化时回调
        
       // 注意：IChangeToken 只能执行一次，修改配置文件的第一次执行回调，后面再更改不会执行
        token.RegisterChangeCallback(state =>
                    {
                      // 回调里 doSomething
                        Console.WriteLine($"Key1:{configurationRoot["Key1"]}");
                        Console.WriteLine($"Key2:{configurationRoot["Key2"]}");
                        Console.WriteLine($"Key3:{configurationRoot["Key3"]}");
                    }, configurationRoot);
      }
```

注意：IChangeToken 只能执行一次，修改配置文件的第一次执行回调，后面再更改不会执行

改用下面的方法：

```csharp
public static void Main(string[] args)
      {
        var builder = new ConfigurationBuilder();
        builder.AddJsonFile("appsettings.json");
        
        var configurationRoot = config.Build();
        IChangeToken token = configurationRoot.GetReloadToken();
        // 注册配置文件发生变化时回调
        
        // argument 1：如何获取IChangeToken
        // argument 2: 处理变更的方法
        ChangeToken.OnChange(() => configurationRoot.GetReloadToken(), 
                             () =>
        {
          		// 回调里 doSomething
              Console.WriteLine($"Key1:{configurationRoot["Key1"]}");
              Console.WriteLine($"Key2:{configurationRoot["Key2"]}");
              Console.WriteLine($"Key3:{configurationRoot["Key3"]}");
         });
      }
```

这样每次修改配置文件就都会触发回调了。

#### 3.8 配置绑定：使用强类型对象承载配置数据

> **要点**
>
> - 支持将配置绑定到已有对象
> - 支持将配置值绑定到私有属性上（默认只能绑定 public）

1. 将配置绑定到已有对象

   比如一个 Config 类：`Config.cs`

   ```csharp
   		class Config
       {
           public string Key1 { get; set; }
           public bool Key5 { get; set; }
           public int Key6 { get; set; }
       }
   ```

   `appsettings.json`

   ```json
   {
     "BindTest": {
       "Key1": "value1",
       "Key2": "value2",
       "Key5": true,
       "Key6": 0
     }
   }
   ```

   `Program.cs`

   ```csharp
   		public static void Main(string[] args)
       {
         var builder = new ConfigurationBuilder();
         var configurationRoot = config.Build();
         
         var config2 = new Config
            {
                Key1 = "config key1",
                Key5 = false,
                Key6 = 100
             };
   
             configurationRoot.GetSection("BindTest").Bind(config2);
             Console.WriteLine($"Key1:{config2.Key1}");
             Console.WriteLine($"Key5:{config2.Key5}");
             Console.WriteLine($"Key6:{config2.Key6}");
       }
       /* Output:
       	Key1:value1
   			Key5:True
   			Key6:0
       */
   ```

   

2. 默认只能绑定 public 的属性，如果想要绑定给私有属性：

   ```csharp
    configurationRoot.GetSection("BindTest")
                           .Bind(config2, options => { options.BindNonPublicProperties = true; });
   // 这样即可绑定私有属性啦
   ```

#### 3.9 自定义配置数据源：实现定制化配置方案

**扩展步骤**

- 实现`IConfigurationSource`
- 实现`IConfigurationProvider`
- 实现`AddXXX`扩展方法

**代码**

`ConfigurationCustom`类库：

1. `MyConfigurationSource.cs`

   ```csharp
   using Microsoft.Extensions.Configuration;
   
   namespace FakeXieCheng.API.ConfigurationCustom
   {
       public class MyConfigurationSource: IConfigurationSource
       {
           // 返回具体的 Provider
           public IConfigurationProvider Build(IConfigurationBuilder builder)
           {
               return new MyConfigurationProvider();
           }
       }
   }
   ```

2. `MyConfigurationProvider.cs`

   ```csharp
   using System;
   using System.Timers;
   using Microsoft.Extensions.Configuration;
   
   namespace FakeXieCheng.API.ConfigurationCustom
   {
       class MyConfigurationProvider: ConfigurationProvider // ConfigurationProvider  继承了 IConfigurationProvider
       {
           private Timer timer; // 使用Timer 模拟线程，每3秒刷新
           public MyConfigurationProvider():base()
           {
               timer = new Timer();
               timer.Elapsed += Timer_Elapsed;
               timer.Interval = 3000; // ms
               timer.Start();
           }
   
           private void Timer_Elapsed(object sender, ElapsedEventArgs e)
           {
               Load(true);
           }
   
           public override void Load()
           {
               // 加载数据
               Load(false);
           }
   
           void Load(bool reload)
           {
               Data["lastTime"] = DateTime.Now.ToString(); // Data：ConfigurationProvider 里的数据承载集合
               if(reload) OnReload();
           }
       }
   }
   ```

3. `Program.cs`

   ```csharp
   public static void Main(string[] args)
   {
     var builder = new ConfigurationBuilder();
     builder.Add(new MyConfigurationSource());
     var configurationRoot = config.Build();
     ChangeToken.OnChange(() => configurationRoot.GetReloadToken(), () =>
                       {
                           Console.WriteLine($"LastTime:{configurationRoot["lastTime"]}");
                       });
                       Console.WriteLine($"开始了");
     
   }
   // Output:
   /*
   	开始了
   	LastTime:05/27/2022 22:17:15
     LastTime:05/27/2022 22:17:18
     LastTime:05/27/2022 22:17:21
     LastTime:05/27/2022 22:17:24
     ...
   */
   ```

这样就完成了自定义配置数据源，但是有一个弊端，就是我们把 `MyConfigurationSource.cs`暴露出来了，而且class属性必须是public，这样十分不友好，改进一下：

4. 增加 `MyConfigurationBuilderExtensions.cs`

   ```csharp
   using FakeXieCheng.API.ConfigurationCustom;
   
   namespace Microsoft.Extensions.Configuration // 方便引用时直接使用
   {
       // 只需要暴露扩展方法，不需要暴露 MyConfigurationSource
       public static class MyConfigurationBuilderExtensions
       {
           public static IConfigurationBuilder AddMyConfiguration(this IConfigurationBuilder builder)
           {
               builder.Add(new MyConfigurationSource());
               return builder;
           }
       }
   }
   ```

   `Program.cs`调整为：

   ```csharp
   public static void Main(string[] args)
   {
     var builder = new ConfigurationBuilder();
     // builder.Add(new MyConfigurationSource());
     config.AddMyConfiguration();
     var configurationRoot = config.Build();
     ChangeToken.OnChange(() => configurationRoot.GetReloadToken(), () =>
                       {
                           Console.WriteLine($"LastTime:{configurationRoot["lastTime"]}");
                       });
                       Console.WriteLine($"开始了");
     
   }
   ```

> 实际开发中，推荐第4步这种做法，把具体实现定义成私有的，然后通过扩展方法暴露出去。

### 4.选项框架

#### 1）服务组件集成配置实践

##### 特性

- 支持单例模式读取配置
- 支持快照
- 支持配置变更通知
- 支持运行时动态修改选项值

#####  设计原则

- 接口分离原则（ISP），我们的类不应该依赖它不使用的配置
- 关注点分离（SoC)，不同组件、服务、类之间的配置不应该相互依赖或耦合

##### 建议

- 为我们的服务设计 XXXOptions
- 使用 IOptions\<XXXOptions\>、IOptionsSnapshot\<XXXOptions\>、IOptonsMonitor\<XXXOptions\>作为服务构造函数的参数

##### 代码

**服务定义**

 ```csharp
 public interface IOrderService
 {
   int ShowMaxOrderCount();
 }
 
 public class OrderService : IOrderService
 {
   OrderServiceOptions _options;
   public OrderService(OrderServiceOptions options)
   {
     _options = options;
   }
   public int ShowMaxOrderCount()
   {
     return _options.MaxOrderCount;
   }
 }
 
 // 这个options 就代表需要从配置里面读取的值
 public class OrderServiceOptions
 {
   public int MaxOrderCount {get; set;} = 100;
 }
 ```

**服务注册**

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
  services.AddSingleton<OrderServiceOptions>();
  services.AddSingleton<IOrderService, OrderService>();
}
```

**使用**

```csharp
[HttpGet]
public int Get([FromServices]IOrderService orderService)
{
  Console.WriteLine($"orderService.ShowOrderCount:{orderService.ShowManOrderCount()}");
  return 1;
}
```

想要将 OrderServiceOptions.MaxOrderCount 与配置绑定起来，修改：

```csharp
public class OrderService : IOrderService
{
  IOptions<OrderServiceOptions> _options;
  public OrderService(IOptions<OrderServiceOptions> options)
  {
    _options = options;
  }
  public int ShowMaxOrderCount()
  {
    return _options.Value.MaxOrderCount;
  }
}
```

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
  services.Configure<OrderServiceOptions>(Configuration.GetSection("OrderService"));
  services.AddSingleton<IOrderService, OrderService>();
}
```

```json
// appsettings.json
{
  "OrdeerService":{
    "MaxOrderCount" : 200
  }
}
```

#### 2）选项数据热更新：让服务感知配置的变化

##### 关键类型

- `IOptionsMonitor<out TOptions>`
- `IOptionsSnapshot<out TOptions>`

##### 场景

- 范围作用域类型使用 `IOptionsSnapshot`
- 单例服务使用 `IOptionsMonitor`

##### 通过代码更新选项

- `IPostConfigureOptions<TOptions>`

##### 代码

将1）中的依赖注入方式改为范围作用域

```csharp
public void ConfigureServices(IServiceCollection services)
{
  services.Configure<OrderServiceOptions>(Configuration.GetSection("OrderService"));
  services.AddScoped<IOrderService, OrderService>();
}
```

如何使得选项能读到配置更新的值呢？调整如下：

```csharp
// OrderService.cs
public class OrderService : IOrderService
{
  IOptionsSnapshot<OrderServiceOptions> _options;
  public OrderService(IOptionsSnapshot<OrderServiceOptions> options)
  {
    _options = options;
  }
  public int ShowMaxOrderCount()
  {
    return _options.Value.MaxOrderCount;
  }
}
```

注入方式使用 Singleton 的话，对应的将`IOptionsSnapshot`=>`IOptionsMonitor`



> **思考**
>
> 现在可以将选项与配置绑定，并且选项也可以读到配置的更新。在实际开发中，如果项目有很多服务注册，`ConfigureServices`的配置代码会非常多，大量的注入代码会在这里。
>
> 如何使我们代码结构更加良好呢？实际上我们可以把服务注册代码放在静态扩展类里，使`ConfigureServices`更加简洁。

定义OrderService扩展类 `OrderServiceExtensions.cs`

```csharp
 namespace Microsoft.Extensions.DependencyInjection
   public static class OrderServiceExtension
   {
     public static IServiceCollection AddOrderService(this IServiceCollection services, IConfiguration configuration)
     {
       services.Configure<OrderServiceOptions>		(Configuration.GetSection("OrderService"));
  		 services.AddScoped<IOrderService, OrderService>();
       return services;
     }
   }
```

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
  		services.AddOrderService(Configuration.GetSection("OrderService"));
}
```

这样 ConfigureServices 就非常简洁。



> 我们可能还有其他需求：把配置读取出来以后，还需要在内存里面进行一些特殊的处理，我们可以使用动态配置的方式。
>
> 在Configure\<\>方法后，调用 `PostConfigure`方法。

```csharp
// OrderServiceExtensions.cs
namespace Microsoft.Extensions.DependencyInjection
   public static class OrderServiceExtension
   {
     public static IServiceCollection AddOrderService(this IServiceCollection services, IConfiguration configuration)
     {
       services.Configure<OrderServiceOptions>(Configuration.GetSection("OrderService"));
       // 调用 PostConfigure
       services.PostConfigure<OrderServiceOptions>(option=>
                                                   {
                                                     options.MaxOrderCount +=100; // 配置读取出来后做加100操作，再绑定
                                                   });
       
  		 services.AddScoped<IOrderService, OrderService>();
       return services;
     }
   }
```

#### 3)为选项数据添加验证：避免错误配置的应用接收用户流量

##### 三种验证方法

- 直接注册验证函数
- 实现 `IValidateOptions<TOptions>`
- 使用`Microsoft.Extensions.Options.DataAnnotations`

> 需要添加验证就不能使用 Configure ，而要使用 AddOptions

```csharp
// OrderServiceExtensions.cs
namespace Microsoft.Extensions.DependencyInjection
   public static class OrderServiceExtension
   {
     public static IServiceCollection AddOrderService(this IServiceCollection services, IConfiguration configuration)
     {
       // services.Configure<OrderServiceOptions>	(Configuration.GetSection("OrderService"));
       
       services.AddOptions<OrderServiceOptions>()
         .Configure(options=>{
           configuration.Bind(options); 
         })
         // 添加验证逻辑
         // 方式1:使用Validate
         //.Validate(options => {
         //  return options.MaxOrderCount <=100;
         // },"MaxOrderCount 不能大于100");
         
         // 方式2:使用DataAnnotations属性注入的方式
         //.ValidateDataAnnotations();
         
       	 // 方式3: 实现 IValidateOptions 接口方式
         .Services.AddSingleton<IValidataOptions<OrderServiceOptions>,OrderServiceValidateOptions>();
       
       
       // 调用 PostConfigure
       services.PostConfigure<OrderServiceOptions>(option=>
                                                   {
                                                     options.MaxOrderCount +=100; // 配置读取出来后做加100操作，再绑定
                                                   });
       
  		 services.AddScoped<IOrderService, OrderService>();
       return services;
     }
   }
```

方式3之实现 `IValidateOptions<TOptions>`接口：

```csharp
public class OrderServiceValidateOptions : IValidataOptions<OrderServiceOptions>
{
  public ValidateOptionsResult Validate(string name, OrderServiceOptions options)
  {
    if(options.MaxOrderCount > 100)
    {
      return ValidateOptionsResult.Fail("MaxOrderCount 不能大于 100")；
    }
    else{
      return ValidateOptionsResult.Success;
    }
  }
}
```





## 开发常用

### 1. SnowFlake 雪花算法❄️

#### 1) Nuget 安装扩展包

安装 Snowflake.Core 依赖包



#### 2) 使用

> IdWorker 应该以单实例模式运行，否则会出现重复Id。

`IdGenerator.cs`：获取 Worker 单例、获取下一个ID

```csharp
using System;
using Snowflake.Core;

namespace FakeXieCheng.API.Helper
{
    // 获取 ❄️雪花算法 worker 单例
    public class IdGenerator
    {
        private static volatile IdWorker _idWorker;
        private static readonly object obj = new object();

        private IdGenerator()
        {
        }

        public static IdWorker GetWorker()
        {
            if (_idWorker == null)
            {
                lock (obj)  
                {
                    if (_idWorker == null)
                    {
                        _idWorker = new IdWorker(1, 1);
                    }
                }
            }

            return _idWorker;
        }

        // 获取下一个ID
        public static long GetNextId()
        {
            var worker = GetWorker();
            return worker.NextId();
        }
    }
}
```



> 拓展：SnowFlake 雪花算法

分布式系统中，有一些需要使用全局唯一ID的场景，这种时候为了防止ID冲突可以使用36位的UUID，但是UUID有一些缺点，首先他相对比较长，另外UUID一般是无序的。有些时候我们希望能使用一种简单一些的ID，并且希望ID能够按照时间有序生成。而twitter的snowflake解决了这种需求，最初Twitter把存储系统从MySQL迁移到Cassandra，因为Cassandra没有顺序ID生成机制，所以开发了这样一套全局唯一ID生成服务。

**主键ID**

自增ID：对于数据敏感场景不宜使用，且不适合于分布式场景。
GUID：采用无意义字符串，数据量增大时造成访问过慢，且不宜排序。

![img](Asp.NET Core.assets/e9768b2db7d07ae869bbab8a796930bf.jpg)

**算法描述**

- 最高位是符号位，始终为0，不可用。
- 41位的时间序列，精确到毫秒级，41位的长度可以使用69年。时间位还有一个很重要的作用是可以根据时间进行排序。
- 10位的机器标识，10位的长度最多支持部署1024个节点。
- 12位的计数序列号，序列号即一系列的自增id，可以支持同一节点同一毫秒生成多个ID序号，12位的计数序列号支持每个节点每毫秒产生4096个ID序号。
