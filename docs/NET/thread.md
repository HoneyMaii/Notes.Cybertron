---
title: 多线程
date: 2022-07-21
---

## Thread 类

### 1. 初始化

```csharp
Thread thread = new Thread();
thread.Start();
```
**线程等待**
我们的程序默认有两个线程，一个是主线程，一个是负责垃圾回收的线程。如果代码不使用多线程，就只有主线程这一条干道。

```csharp
// 1. join
thread.Join();

// 2. sleep
Thread.Sleep(1000); // 主线程阻塞 1 秒，保存上下文，但是释放 CPU 时间片
```
> 两者的区别
- 在主线程中调用 `Thread.Sleep(1000)`，表示主线程阻塞自己 1 秒。
- 在主线程中使用子线程调用 `Join()` 方法，表示子线程告诉主线程你需要阻塞一会，直到我完成任务。
两者虽然都是阻塞主线程，但是一个是主线程自己阻塞自己，另一个是子线程阻塞主线程。

## 线程池
线程池可以重用线程，对线程加以限制，避免线程重复的创建与销毁造成的额外开销。（设计模式中享元模式的具体使用）
```csharp
ThreadPool.QueueUserWorkItem(WaitCallback callback) // WaitCallback 为接受一个参数没有返回值的委托
ThreadPool.QueueUserWorkItem(state =>
        {
            // dosomething
        });
```
可以设置线程池的最大、最小线程数量
```csharp
ThreadPool.SetMinThreads(线程池中辅助线程的最大数目（工作线程）,线程池中异步 I/O 线程的最大数目);
ThreadPool.SetMaxThreads(8, 16);
// 获取线程池中最大线程数量
ThreadPool.GetMaxThreads(out int workerThreads, out int completionPortThreads);
```
**ThreadPool 如何完成线程等待？**
```csharp
// ManualResetEvent 是一个类，包含一个 bool 属性 initialState
// initialState为 false-->调用WaitOne则等待--> 执行 Set方法后--> initialState变为 true -->WaitOne直接过去
// initialState为 true-->调用WaitOne则直接过去-> 执行 ReSet方法后--> initialState变为 false -->调用WaitOne 等待
ManualResetEvent manualResetEvent = new ManualResetEvent(false);
manualResetEvent.WaitOne();
        
ThreadPool.QueueUserWorkItem(state =>
        {
            // dosomething
            manualResetEvent.Set(); // -> 变更为 true
        });
Console.WriteLine($"等待 QueueUserWorkItem 执行完毕");
```



## haha
