// ---- vite.config.ts ----
imports: defineConfig from 'vite', react from '@vitejs/plugin-react',
         tailwindcss from '@tailwindcss/vite', path from 'node:path'

config:
  plugins: [react(), tailwindcss()]
  resolve.alias: '@' → project root (matches tsconfig.json's "@/*")
  server: port 3001, host 0.0.0.0
  test: environment 'jsdom', globals true, setupFiles ['./vitest.setup.ts']

// ---- index.tsx ----
imports: createRoot from 'react-dom/client', AuthProvider from './services/auth',
         App from './App', './styles/index.css'

on load:
  root ← #root element
  render: <AuthProvider><App/></AuthProvider> into root
  // AuthProvider wraps App, not the reverse — App's router components can call useAuth()

// ---- package.json ----
name: 'frontend'
scripts: dev→vite, build→"vite build", preview→"vite preview", test→"vitest run",
         test:unit→"vitest run" (excl. tests/integration/**), test:integration→"vitest run tests/integration"
deps: react, react-dom, react-router-dom, recharts, lucide-react
devDeps: @vitejs/plugin-react, @tailwindcss/vite, tailwindcss, typescript, vite, vitest, jsdom,
         @testing-library/react, @testing-library/jest-dom, @types/react, @types/react-dom, @types/node

// ---- tsconfig.json ----
compilerOptions: strict true, jsx "react-jsx", moduleResolution "bundler", paths "@/*" → same as Vite alias

// ---- index.html ----
no Tailwind CDN script, no CDN import map (everything is a real npm dep, bundled by Vite)
contains: font <link> tags, <div id="root">, <script type="module" src="/index.tsx">

// ---- .gitignore ----
node_modules/

// ---- vitest.setup.ts ----
imports: jest-dom's Vitest matchers

// ---- README.md ----
note: frontend/ is the active app under development; ceview/ remains deployed until cutover
