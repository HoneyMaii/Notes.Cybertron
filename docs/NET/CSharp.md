## C#
### System.Linq
#### C# ToLookup 的用法
> 背景
> 现在有一批产品数据，假设我们想要根据类别列出产品清单
> 我们使用 `GroupBy`可以很轻松的实现功能
```csharp
foreach (var group in products.GroupBy(p => p.Category))
{
  Console.WriteLine(group.Key);
  foreach (var item in group)
  {
    Console.WriteLine("\t" + item);
   }
}
```
使用 **`GroupBy()`** 扩展方法时，使用了延迟执行。这意味着，当你遍历集合的时候,下一个要出现的项目可能会或者可能不会被加载。 这是一个很大的性能改进，但它会引起有趣的副作用。
在 `GroupBy` 时，实际上时在第一项被使用时创建分组，而不是在 **`GroupBy`** 被调用时。


> 试想下面这个场景，从数据库中加载数据，然后想组合在一起，并且快速查找，比如下面这段代码：
```csharp
var groups = products.GroupBy(p => p.Category);
//删除所有属于Garden的产品
 products.RemoveAll(p => p.Category == "Garden");

foreach (var group in groups)
{
    Console.WriteLine(group.Key);
    foreach (var item in group)
  {
    Console.WriteLine("\t" + item);
  }
}
```
执行后发现，所有的 Garden 分类的产品数据都不见了，但是在 RemoveAll 之前我们已经将 groups 赋值了。

这就引出了 **`ToLookup`** 方法了，`ToLookup` 方法创建了一个类似 `Dictionary` 的 List 数据结构。 它是一个新的 Collection，和字典不同的是，Lookup 一旦创建，是不可变的，这就意味着不能对它进行删除和修改。
为了方便理解，可以想象这样的数据结构 `Dictionary<Key,List>`,即一个 Key 对应一个集合。
```csharp
var productsByCategory = products.ToLookup(p => p.Category);

private static void PrintCategory(ILookup<string, Product> productsByCategory,string categoryName)
{
    foreach (var item in productsByCategory[categoryName])
  {
    Console.WriteLine(item);
  }
}
```
还可以使用类似索引的功能得到某个项目，如某个类别的所有产品
```csharp
private static void ShowCategory(ILookup<string, Product> productsByCategory,string categoryName)
{
    foreach (var item in productsByCategory[categoryName])
  {
    Console.WriteLine(item);
  }
}
```
