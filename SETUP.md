# Zexo Studio — Setup Guide

> Lightweight local LLM client. Fast, clean, not bloated.

## Prerequisites (Windows)

You need to install these **one time** before building:

### 1. Node.js (LTS)
Download and install from: https://nodejs.org/
- Choose the LTS version (not Current)
- During install, check "Add to PATH"

### 2. Rust
Open PowerShell and run:
```powershell
winget install Rustlang.Rustup
```
Or download from: https://rustup.rs/

After install, **restart your terminal** and verify:
```powershell
rustc --version
cargo --version
```

### 3. Visual Studio C++ Build Tools
**Required for compiling llama.cpp.**

Download "Build Tools for Visual Studio" from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

During install, select:
- ✅ **Desktop development with C++**
- ✅ **MSVC v143 build tools**
- ✅ **Windows SDK**
- ✅ **CMake tools for Windows**

### 4. CMake
Usually installed with Visual Studio Build Tools above. Verify:
```powershell
cmake --version
```
If not found, install: https://cmake.org/download/

### 5. CUDA Toolkit (for NVIDIA GPU support)
**Required if building with CUDA (default).**

Download from: https://developer.nvidia.com/cuda-downloads
- Choose Windows → x86_64 → your Windows version
- Install with default options

Verify:
```powershell
nvcc --version
```

> **No NVIDIA GPU?** Build without CUDA:
> ```powershell
> cargo tauri build --no-default-features
> ```

---

## Building Zexo Studio

### Development Mode
```powershell
cd zexo-studio

# Install npm dependencies (first time only)
npm install

# Run in dev mode (hot-reload)
npm run tauri dev
```

### Production Build
```powershell
# Build optimized release binary
npm run tauri build
```

The installer will be in: `src-tauri/target/release/bundle/`

---

## Using Zexo Studio

### Adding Models
1. Download `.gguf` model files (e.g., from HuggingFace)
2. Place them in `C:\Users\<you>\zexo-models\` (default directory)
3. Or change the models directory in Settings

### Downloading Models from HuggingFace
1. Click **Models** in the sidebar
2. Go to the **Download** tab
3. Search for models or paste a direct URL
4. If the model is gated, add your HuggingFace token in Settings

### Recommended Models to Start
| Model | Size | Good For |
|-------|------|----------|
| `Llama-3.2-3B-Instruct-Q4_K_M.gguf` | ~2 GB | Fast general chat |
| `Mistral-7B-Instruct-v0.3-Q4_K_M.gguf` | ~4 GB | Quality conversations |
| `Qwen2.5-7B-Instruct-Q4_K_M.gguf` | ~4 GB | Coding + chat |
| `DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf` | ~4 GB | Reasoning |

### Temp Chat Mode
Toggle "Temp Chat" in the sidebar to enable ephemeral mode.
Messages are **not saved** to history — perfect for quick one-off questions.

---

## Project Structure

```
zexo-studio/
├── src/                    # Frontend (HTML/CSS/JS)
│   ├── index.html          # Main UI layout
│   ├── styles/main.css     # Complete design system
│   ├── js/
│   │   ├── app.js          # Main app controller
│   │   ├── api.js          # Tauri IPC bridge
│   │   ├── chat.js         # Chat UI + streaming
│   │   ├── sidebar.js      # Conversation sidebar
│   │   ├── models.js       # Model management + HF
│   │   ├── settings.js     # Settings panel
│   │   └── markdown.js     # Markdown renderer
│   └── assets/logo.png     # App icon
├── src-tauri/              # Rust backend
│   ├── Cargo.toml          # Dependencies
│   ├── tauri.conf.json     # Tauri config
│   └── src/
│       ├── main.rs         # Entry point
│       ├── lib.rs          # App setup + state
│       ├── commands.rs     # All Tauri commands
│       ├── llm/
│       │   ├── engine.rs   # llama.cpp wrapper
│       │   └── models.rs   # Model file scanner
│       ├── chat/
│       │   ├── types.rs    # Data structures
│       │   └── history.rs  # Chat persistence
│       └── settings.rs     # Settings persistence
├── package.json
└── vite.config.js
```

---

## Troubleshooting

### "CMake not found"
Ensure CMake is in your PATH. Restart terminal after installing Visual Studio Build Tools.

### "CUDA not found" / "nvcc not found"
- Install CUDA Toolkit from NVIDIA
- Restart terminal
- Or build without CUDA: edit `Cargo.toml` and change `default = ["cuda"]` to `default = []`

### "Model loading fails"
- Ensure the file is a valid `.gguf` format
- Check file is not corrupted (re-download)
- Try reducing GPU layers in Settings if you get memory errors

### Build takes a long time
First build compiles llama.cpp from source (~5-10 min). Subsequent builds are fast.

---

## Architecture Highlights

- **No Ollama** — Uses llama.cpp directly via Rust bindings
- **No Electron** — Tauri v2 (WebView2 on Windows, ~10MB vs Electron's 200MB+)
- **No Telemetry** — Zero network calls except user-initiated HuggingFace downloads
- **No Bloat** — Minimal dependencies, fast startup
- **CUDA Support** — Full GPU acceleration for NVIDIA cards
- **Source Available** — Read every line of code
