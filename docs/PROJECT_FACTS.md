# Generated Project Facts

World Tree 的版本、Git HEAD、单元测试数、集成测试数、发布包文件数与大小，不再由状态文档手工维护。

运行：

```bash
npm run facts:generate
```

脚本会执行真实单元测试、集成测试与 `npm pack --dry-run --json`，然后写入被 Git 忽略的 `output/project-facts.json`。该文件包含：

- 当前 `package.json` 版本；
- 当前完整 Git SHA；
- 实际 TAP 测试计数；
- 实际发布包文件数、压缩前后大小；
- 8 个 canonical 产品入口；
- `HUMAN_VALIDATION_REQUIRED` 可玩状态边界。

运行：

```bash
npm run facts:check
```

会重新执行事实探测并拒绝错误的 commit、版本、测试数或包计数。`generatedAt` 不参与陈旧判断。发布证据和安全快照应引用该机器文件；历史报告不得覆盖它。

覆盖率门槛由 `npm run verify:coverage` 执行。v0.5 起始生产源码基线为 line 70.36%、branch 61.05%、function 70.18%，因此本轮以 70% / 60% / 70% 作为不低于基线的保守门槛；测试与脚本本身排除在生产源码统计之外。

该文件不提交生成结果，因为把“包含自身的提交 SHA”写进同一个 Git 提交在数学上无法稳定。生成脚本与验证器是受版本控制的事实来源，运行产物属于发布证据。
