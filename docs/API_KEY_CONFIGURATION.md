# API Key 配置说明

项目不会把真实 API key 放进代码。

推荐做法：

1. 复制示例配置：

   ```powershell
   Copy-Item config\app.env.example config\app.env
   ```

2. 编辑 `config/app.env`，填入自己的 `LLM_API_KEY` 和 `EMBEDDING_API_KEY`。

3. 重启服务：

   ```powershell
   python run_web.py
   ```

也可以用交互式脚本写入配置：

```powershell
python scripts\configure_api_keys.py
```

`config/app.env` 和根目录 `.env` 都会被 `.gitignore` 忽略，不应提交到 GitHub。

前端“智能问答”会要求用户输入 API key 才能提交问题。这个 key 只随当前请求发送给后端调用 LLM，不会写入 `config/app.env` 或其他本地配置文件。

配置加载顺序：

1. 默认值来自 `api/config.py`
2. 读取根目录 `.env`
3. 读取 `config/app.env`

后读取的配置会覆盖先读取的同名配置。
