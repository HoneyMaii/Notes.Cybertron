# Resharper 使用教程

## 操作篇

### 1.快捷键

`Ctrl+Alt+Insert` 再当前项目快速添加文件(类、接口、枚举、控制器etc.)

![image-20220725143817884](F:\documents\Resharper 使用教程.assets\image-20220725143817884.png)

光标放在文件上 `Ctrl+Shift+R` 进行快速**重构**

![image-20220725150132568](F:\documents\Resharper 使用教程.assets\image-20220725150132568.png)

![image-20220725155327957](F:\documents\Resharper 使用教程.assets\image-20220725155327957.png)

```
封装字段 —— Introduce Field
提取方法 —— Extract Method
提取接口 —— Extract Interface
提取为基类 —— Extract SuperClass
提升局部变量 —— Introduce Variable
移除参数 —— 移到 Change Signature (改变方法签名)中
重命名 —— Rename（Resharper 会根据对象的类型名称，提供几个最合适的名称）
重新排列参数 —— 
```

`Alt + Insert` 自动生成代码

Resharper 可以通过提供自动生成样板代码帮助您集中致力于编程上。

![image-20220725161729975](F:\documents\Resharper 使用教程.assets\image-20220725161729975.png)

`Ctrl + Alt + .` TODO 管理器

| 快捷键                       | 用途                                                         |      |
| ---------------------------- | ------------------------------------------------------------ | ---- |
| `Alt + F7`                   | 查找引用                                                     |      |
| Ctrl + N                     | Go To Everything 定位到任何，非常强大                        |      |
| Ctrl + Shift + N             | Go To File 定位到文件                                        |      |
| Ctrl + F12                   | Go To File Member 在当前类中查找                             |      |
| F2                           | 重命名任何文件，重构利器                                     |      |
| Ctrl + Shift + Alt + Up/Down | 交换上下行代码位置                                           |      |
| Ctrl + W                     | 快速选中整个/一块单词                                        |      |
| Ctrl + Alt + F               | Clean Code                                                   |      |
| Ctrl + Alt + J               | Sorround with Template,快速添加语句块如 if、for、try catch、using、#region |      |
| Ctrl + Q                     | 快速文档                                                     |      |
| Ctrl + E                     | 显示最近编辑的文件                                           |      |
| Ctrl + F11                   | 文档结构（File Structure),可以更直观地看到整个成员变量窗口、类型以及访问权限 |      |



### 2.提示

- `工具->选项->文本编辑器->C#->常规->自动列出成员` 勾选这个选择框。如果不勾选，当使用某个方法的时候，不会提示参数。
- `工具->选项->文本编辑器->C#->常规->自动列出成员` 如果卸载了 Resharper 并且这两项没有勾选，VS 不会实时提示错误。因此卸载 Resharper 后，要重新勾选上。
