#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const server = new Server(
  { name: "mcp-clipboard", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_clipboard_image",
      description:
        "Lấy ảnh từ clipboard của hệ điều hành (macOS, Windows, Linux).",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_clipboard_image") {
    const tempFile = path.join(os.tmpdir(), `mcp_clip_${Date.now()}.png`);

    try {
      // Logic xử lý theo từng hệ điều hành
      const platform = process.platform;

      if (platform === "darwin") {
        execSync(
          `osascript -e 'write (the clipboard as «class PNGf») to (POSIX file "${tempFile}")'`,
        );
      } else if (platform === "win32") {
        execSync(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetImage().Save('${tempFile}', [System.Drawing.Imaging.ImageFormat]::Png)"`,
        );
      } else {
        // Linux (Yêu cầu xclip hoặc wl-clipboard)
        try {
          execSync(`xclip -selection clipboard -t image/png -o > ${tempFile}`);
        } catch {
          execSync(`wl-paste -t image/png > ${tempFile}`);
        }
      }

      if (!fs.existsSync(tempFile)) {
        throw new Error("Không tìm thấy ảnh trong clipboard");
      }

      const imageBuffer = fs.readFileSync(tempFile);
      const base64Image = imageBuffer.toString("base64");
      fs.unlinkSync(tempFile); // Dọn dẹp file tạm

      return {
        content: [
          { type: "text", text: "Đã lấy ảnh thành công!" },
          { type: "image", data: base64Image, mimeType: "image/png" },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Lỗi: ${error.message}. Hãy chắc chắn bạn đã copy một vùng ảnh.`,
          },
        ],
        isError: true,
      };
    }
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
