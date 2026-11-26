import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useStore } from "../state/store";

export default function AntdShell({ children }: { children: React.ReactNode }) {
  const { config, previewSite } = useStore();
  const activeAccent = previewSite && "accent" in previewSite ? previewSite.accent : config.site.accent;
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: activeAccent || "#0b8f5f",
          borderRadius: 10,
          controlHeight: 34,
          fontFamily: "var(--font-ui)",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
