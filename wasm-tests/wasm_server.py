#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

class WASMHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for WASM
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()
    
    def guess_type(self, path):
        mimetype, encoding = super().guess_type(path)
        if path.endswith('.wasm'):
            return 'application/wasm', encoding
        return mimetype, encoding

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    
    os.chdir('/workspaces/AudioVerse/wasm-tests')
    
    with socketserver.TCPServer(("", port), WASMHTTPRequestHandler) as httpd:
        print(f"🌐 WASM Development Server running at http://localhost:{port}")
        print(f"📁 Serving files from: {os.getcwd()}")
        print("\n📋 Available examples:")
        print(f"   🦀 Rust Example: http://localhost:{port}/rust-example/")
        print(f"   ⚡ C++ Example:  http://localhost:{port}/cpp-example/")
        print("\n🔄 Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    main()
