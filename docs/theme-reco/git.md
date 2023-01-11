# Git使用

## Git 配置
1. **全局配置**
```bash
git config --global user.name 'YourName'
git config --global user.email 'YourEmailAddress'
```

## Git SSH 配置
右键打开 Git bash
1.查看是否配置过密钥
```bash
cat ~/.ssh
```
提示 NotFound，则代表未配置过 SSH，进行下一步
2.创建 SSH
```bash
ssh-keygen -t rsa -C 'YourEmailAddress'
```
之后出现提示就一直按 Enter 即可
3. 查看生成的 SSH Key
```bash
cat ~/.ssh/id_rsa.pub
```
你讲看到这样一段
```
ssh-rsa XXXXXXXXXXXXXX YourEmailAddress
```
代表生成成功
4.登录 GitHub/GitLab 等
- github
 Setting/SSH and GPG Keys，选择 New SSH Key，在 Key 这一栏填写刚刚生成的 ssh key
- gitlab
 Preferences/SSH Keys,在 Key 这一栏填写刚刚生成的 ssh key,点击 Add Key 即可
## Git分支操作

### 1.创建分支

```bash
git branch develop
```

### 2.查看本地分支：

```bash
git branch
```

注:名称前面加* 号的是当前的分支

### 3.查看远程分支：

加上-a参数可以查看远程分支，远程分支会用红色表示出来（如果你开了颜色支持的话）

```bash
git branch -a
```

![img](https://img2018.cnblogs.com/blog/552373/201811/552373-20181113100106148-1793653825.png)

### 4.切换分支

```bash
git checkout branch_name
```

### 5.删除本地分支

```bash
git branch -d branch_name
```

### 6.删除远程分支

```bash
git branch -r -d origin/branch-name  
git push origin :branch-name 
```

### 7.如果远程新建了一个分支，本地没有该分支。

可以利用 git checkout --track origin/branch_name ，这时本地会新建一个分支名叫 branch_name ，会自动跟踪远程的同名分支 branch_name。

```bash
git checkout --track origin/branch_name
```

### 8.如果本地新建了一个分支 branch_name，但是在远程没有。

这时候 push 和 pull 指令就无法确定该跟踪谁，一般来说我们都会使其跟踪远程同名分支，所以可以利用 git push --set-upstream origin branch_name ，这样就可以自动在远程创建一个 branch_name 分支，然后本地分支会 track 该分支。后面再对该分支使用 push 和 pull 就自动同步。

```bash
git push --set-upstream origin branch_name
```

###  9.合并分支到master上

 首先切换到master分支上

```bash
git  checkout master
```

如果是多人开发的话 需要把远程master上的代码pull下来

```bash
git pull origin master
```

然后我们把dev分支的代码合并到master上

```bash
git  merge dev
```

然后查看状态

```bash
git status
```

### 10.本地分支的开发流程(优雅 merge)

git 在一个分支上开发一段时间后，会留下很多次的 commit, 当一个功能阶段性的完成后，需要将该分支 merge 到主干，如果直接使用 `git merge branch `会将该分支下所有的提交都 merge 到主干，有时这并不是我们所需要的，我们只需要总结一下该分支，然后以该总结的 commit 合并到主干就可以了。具体操作：

```bash
1、git checkout master 

2、git merge --squash branch

3、git commit -m "branch功能完成，合并到主干" 
```

经过以上的3条命令，可以看到主分支上只有一个提交记录，分支的多次提交都已经合并提交完成！

### 11.本地分支工作流程

去自己的工作分支
`$ git checkout work`

工作
`....`

提交工作分支的修改
`$ git commit -a`

回到主分支
`$ git checkout master`

获取远程最新的修改，此时不会产生冲突
`$ git pull`

回到工作分支
`$ git checkout work`

用 rebase 合并主干的修改，如果有冲突在此时解决
`$ git rebase master`

回到主分支
`$ git checkout master`

合并工作分支的修改，此时不会产生冲突。
`$ git merge work`

提交到远程主干
`$ git push`

这样做的好处是，远程主干上的历史永远是线性的。每个人在本地分支解决冲突，不会在主干上产生冲突。



> 在`rebase`的过程中，也许会出现冲突 (conflict)。
>
> 在这种情况，Git会停止`rebase`并会让你去解决冲突；
>
> 在解决完冲突后，用”`git add`“命令去更新这些内容的索引(index), 然后，你无需执行 `git commit`,只要执行:

```shell
$ git rebase --continue
```

这样git会继续应用 (apply) 余下的补丁。

在任何时候，可以用`--abort`参数来终止 `rebase` 的操作，并且”work`“ 分支会回到 `rebase` 开始前的状态。

```shell
$ git rebase --abort
```
### 12.从某一个commit开始创建本地分支

```shell
// 通过checkout 跟上commitId 即可创建制定commit之前的本地分支
git checkout commitId -b 本地新branchName
```

上传到远程服务器

```shell
// 依然通过push 跟上你希望的远程新分支名字即可
git push origin HEAD:远程新branchName
```

## Git 撤销

### 1.未使用 git add 缓存代码时。

可以使用 `git checkout -- filepathname` (比如： git checkout -- readme.md ，不要忘记中间的 “--” ，不写就成了检出分支了！！)。

放弃所有的文件修改可以使用 `git checkout .` 命令。

此命令用来放弃掉所有还没有加入到缓存区（就是 git add 命令）的修改：内容修改与整个文件删除。

但是此命令不会删除掉刚新建的文件。因为刚新建的文件还没已有加入到 git 的管理系统中。所以对于git是未知的。自己手动删除就好了。

### 2.已经使用了 git add 缓存了代码。

可以使用 `git reset HEAD filepathname` （比如： git reset HEAD readme.md）来放弃指定文件的缓存，

放弃所有的缓存可以使用 `git reset HEAD .` 命令。

此命令用来清除 git 对于文件修改的缓存。相当于撤销 git add 命令所在的工作。

在使用本命令后，本地的修改并不会消失，而是回到了如（一）所示的状态。继续用（一）中的操作，就可以放弃本地的修改。

### 3.已经用 git commit 提交了代码。

可以使用 `git reset --hard HEAD^` 来回退到上一次commit的状态。

此命令可以用来回退到任意版本：`git reset --hard commitid` 

## Git 查看提交记录

`git show <commit id>`

## Git提交

`feat`: 新功能（feature）
`fix`: 修补bug
`docs`: 文档（documentation）
`style`: 格式（不影响代码运行的变动）
`refactor`: 重构（即不是新增功能，也不是修改bug的代码变动）
`chore`: 构建过程或辅助工具的变动
`revert`: 撤销，版本回退
`perf`: 性能优化
`test`：测试
`improvement`: 改进
`build`: 打包
`ci`: 持续集成

