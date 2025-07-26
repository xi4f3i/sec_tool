# SEC文件内容获取工具

这个项目使用py-xbrl库来获取和解析SEC（美国证券交易委员会）的XBRL文件内容。

## 功能特性

- 🔍 解析SEC的XBRL文件
- 📊 将数据转换为JSON和CSV格式
- 🌐 支持原始HTML内容获取
- 📝 文本内容提取
- 💾 本地缓存支持

## 安装依赖

```bash
# 安装Python依赖
pip install -r requirements.txt
```

## 使用方法

### 1. 简单示例

运行简单的示例脚本：

```bash
python simple_example.py
```

这将：
- 解析指定的SEC文件
- 显示解析到的事实数量
- 显示前5个事实的详细信息
- 将结果保存到`output/sec_facts.json`

### 2. 完整功能示例

运行完整功能的解析器：

```bash
python sec_parser.py
```

这将提供多种获取内容的方法：
- XBRL结构化数据解析
- 原始HTML内容获取
- 文本内容提取
- 多种格式输出（JSON、CSV）

### 3. 自定义使用

```python
from sec_parser import SECParser

# 创建解析器
parser = SECParser()

# 解析SEC文件
url = "https://www.sec.gov/Archives/edgar/data/0001387467/000138746724000073/aosl-20240630.htm"
instance = parser.parse_sec_file(url)

# 获取数据
facts = parser.get_facts_as_json(instance)
print(f"解析到 {len(facts)} 个事实")
```

## 输出文件说明

运行脚本后，会在`output/`目录下生成以下文件：

- `xbrl_facts.json` - XBRL事实的JSON格式
- `xbrl_facts.csv` - XBRL事实的CSV格式
- `raw_content.html` - 原始HTML内容
- `text_content.txt` - 提取的文本内容

## 重要配置

### SEC请求头设置

SEC要求设置特定的请求头：

```python
cache.set_headers({
    'From': 'your-email@example.com',
    'User-Agent': 'Your Company Name AdminContact@example.com'
})
```

请将示例中的邮箱和公司名称替换为您的实际信息。

### 缓存目录

默认缓存目录为`./cache`，您可以在创建`SECParser`实例时指定：

```python
parser = SECParser(cache_dir='./your_cache_dir')
```

## 数据结构说明

### XBRL事实结构

每个XBRL事实包含以下字段：

- `concept`: 概念标签
- `value`: 事实值
- `context`: 上下文ID
- `unit`: 单位ID
- `decimals`: 小数位数
- `period`: 期间信息

### 示例输出

```json
[
  {
    "concept": "Entity Registrant Name",
    "value": "AOSL",
    "context": "FD2024Q2",
    "unit": null,
    "decimals": null,
    "period": "2024-06-30"
  },
  {
    "concept": "Document Type",
    "value": "10-Q",
    "context": "FD2024Q2",
    "unit": null,
    "decimals": null,
    "period": "2024-06-30"
  }
]
```

## 错误处理

脚本包含完整的错误处理机制：

- 网络连接错误
- 文件解析错误
- 缓存错误
- 文件保存错误

所有错误都会记录到日志中，便于调试。

## 注意事项

1. **SEC访问限制**: SEC对访问频率有限制，建议合理控制请求频率
2. **缓存使用**: 使用本地缓存可以避免重复下载相同文件
3. **请求头**: 必须设置正确的请求头，否则可能被SEC拒绝访问
4. **文件格式**: 确保目标文件是有效的XBRL格式

## 故障排除

### 常见问题

1. **网络连接错误**
   - 检查网络连接
   - 确认URL是否正确
   - 检查防火墙设置

2. **解析错误**
   - 确认文件是有效的XBRL格式
   - 检查缓存目录权限
   - 查看日志获取详细错误信息

3. **权限错误**
   - 确保对输出目录有写权限
   - 检查缓存目录权限

## 许可证

本项目使用ISC许可证。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。 