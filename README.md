# jquery-bs5-upgrade-recipes

PLM-5673 POC：评估能否用 jscodeshift recipe 自动完成 Grails/GSP 项目中重复的升级改动。

- jQuery 2.2.4 → 3.7.1
- Bootstrap 3 → 5 的 `data-*` 属性和导航 `active` 规则

Inspinia 2.4 → 4 不在自动化范围内，由人工处理。

Ticket 描述和当前进度见 [docs/PLM-5673.md](docs/PLM-5673.md)。

## 快速开始

需要 Node 18 或更高版本。

```bash
npm install
npm test
```

在示例项目上试运行，不会修改任何项目文件：

```bash
node bin/run.js --root examples/sample-grails --config examples/targets.json
```

用于真实项目时：

1. 复制 `config/targets.json`，把 `CHANGE-ME` 改成 business JS 和模块 GSP 的路径。
2. 不加 `--apply` 先试运行，查看 `reports/findings.csv`。
3. 确认后在单独分支上加 `--apply`，再用 `git diff` 复核。

```bash
node bin/run.js --root /path/to/project --config my-targets.json
```

```bash
node bin/run.js --root /path/to/project --config my-targets.json --apply
```

`--rules jq-removed-apis,bs5-attrs` 可以只运行指定规则，方便按规则分开提交。

## 场景和规则

| 场景 | 规则 | 作用范围 | 不确定时 |
|---|---|---|---|
| 1. Business JS 的 jQuery 旧语法 | `jq-removed-apis`、`jq-deprecated-events` | 白名单内的 `.js` | 报告 |
| 2. GSP 内联 JS 的旧语法 | 同上，先经过 `gsp/mask.js` | `<script>`、`<g:javascript>`、`<asset:script>` | 报告；解析失败的块不改 |
| 3. `data-*` → `data-bs-*` | `bs5-attrs`、`bs5-js-selectors` | GSP HTML，以及 JS 里的选择器和 `.attr()` | 报告 |
| 4. `active` 从 `li` 移到 `a` | `bs5-nav-active` | 可确认的 Bootstrap 导航 | 报告 |
| 5. JS 生成的 HTML | `bs5-js-html-strings`、`bs5-nav-active` | JS 字符串和模板字符串 | 报告 |
| 6. Inspinia 升级 | 无 | 用 `exclude` 排除 | 人工处理 |

规则统一维护在 `rules/`。JS 和 GSP 的 jQuery 规则共用同一批 transform，HTML 属性规则也共用 `rules/bs5-html.js`。

## 处理原则

- **默认不写文件：** 只有加 `--apply` 才会修改项目。
- **只处理白名单：** 只有 `config` 中 `include` 匹配且未被 `exclude` 排除的文件才会处理。
- **证明不了就不改：** jscodeshift 没有类型信息，无法确认接收者时只写入报告。
- **GSP 按位置替换：** 不重新序列化文件，脚本外的 Groovy 和注释保持原样。
- **占位符必须完整还原：** 否则放弃修改这个脚本块。
- **保留文件格式：** 保留 CRLF、缩进和 BOM；非 UTF-8 文件跳过并报告。

## 报告

每次运行都会生成 `reports/findings.csv` 和 `reports/findings.json`。报告含代码片段，`reports/` 已被 git 忽略，不要提交。

| `status` | 含义 |
|---|---|
| `changed` | 已自动修改（试运行时表示将会修改） |
| `manual` | 需要人工确认 |
| `unchanged` | 脚本块处理成功，没有需要改的内容 |
| `parse-failed` | 无法解析，内容未修改 |
| `placeholder-lost` | 占位符校验失败，脚本块未修改 |

试运行时也会输出 GSP 脚本块的处理率：`(changed + unchanged) / 脚本块总数`。

## 已知限制

- Recipe 只验证过 `examples/` 中虚构的示例，还没有在真实项目上运行。
- 只改 `data-*` 属性和导航 `active`，`pull-right`、`col-*`、`panel` 等 class 尚未实现。
- `.data('target')` 这类读取默认只报告，因为无法确认是不是 Bootstrap 的属性。
- 跨多个字符串拼接的导航 HTML，以及内联事件属性，只报告不修改。
- TagLib、Controller 等 Groovy 代码输出的 JS 和 HTML 尚未扫描。
- OpenRewrite 接入尚未验证。`rewrite-codemods` 仓库已于 2026 年 8 月 7 日归档。
- 工具只改源码，不能替代在 Bootstrap 5 环境下的运行时回归。

## 目录

```text
bin/run.js      命令行入口、白名单、写文件和报告
config/         目标文件模板
docs/           Ticket 描述和进度
gsp/            GSP 分段、占位符和转换流程
lib/            解析器、AST 工具和接收者判断
rules/          Bootstrap 5 映射和 HTML 改写，唯一规则来源
transforms/     JS 规则和执行顺序
examples/       虚构的示例项目，不要放入真实业务代码
test/           单元测试和命令行测试
```
