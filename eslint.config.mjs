import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // React 19 新规则：效果内同步 setState。项目中多为挂载后初始化/数据联动，
  // 属合理用法，降级为警告（参考项目同样未满足该规则）。
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 参考项目与测试脚本不参与检查
    "参考/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
