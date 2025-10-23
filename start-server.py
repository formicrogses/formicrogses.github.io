#!/usr/bin/env python3
"""
简单的HTTP服务器，用于本地查看网站
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # 添加CORS头部，允许跨域请求
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def log_message(self, format, *args):
        # 自定义日志格式
        print(f"[{self.log_date_time_string()}] {format % args}")

def start_server():
    print("=" * 50)
    print("🚀 启动本地服务器...")
    print("=" * 50)
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"✅ 服务器运行在: http://localhost:{PORT}")
        print(f"📁 服务目录: {DIRECTORY}")
        print("-" * 50)
        print("📌 访问地址:")
        print(f"   🌐 http://localhost:{PORT}/")
        print("-" * 50)
        print("💡 按 Ctrl+C 停止服务器")
        print("=" * 50)
        
        # 自动在浏览器中打开主页
        webbrowser.open(f'http://localhost:{PORT}/')
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n" + "=" * 50)
            print("👋 服务器已停止")
            print("=" * 50)

if __name__ == "__main__":
    start_server()
