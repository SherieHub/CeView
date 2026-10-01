// ---- layout/nav.ts ----
imports: LucideIcon type, {LayoutDashboard, Sparkles, CalendarDays, TrendingUp, Settings} from 'lucide-react'

type NavId: 'dashboard' | 'content' | 'calendar' | 'performance' | 'settings'
interface NavSection { section: string }
interface NavItem { id: NavId, label, icon: LucideIcon, title, sub, badge? }
type NavEntry: NavSection | NavItem

const NAV: NavEntry[]  // sections: Intelligence(Dashboard+badge), Create(Content Studio, Calendar),
                        // Measure(Performance), Account(Settings) — excludes prototype's content2

function navItems(): NavItem[]         // filters NAV down to NavItem entries
function navItemById(id): NavItem | undefined

// ---- components/shared/useOverlayStack.tsx ----
imports: createContext, useContext, useEffect, useState, ReactNode from 'react'

type OverlayKind: 'modal' | 'drawer' | 'sidebar'
interface OverlayStackValue { stack, isOpen(kind), push(kind), pop(kind), dismissTop(), scrimVisible }

function OverlayStackProvider({children}):
  state: stack: OverlayKind[] ← []
  on mount → add 'keydown' listener → on Escape: dismissTop()
  push(kind) → append if not already present
  pop(kind) → remove this kind specifically
  dismissTop() → remove only the last-pushed entry
  scrimVisible ← stack.length > 0
  render: children wrapped in context provider

function useOverlayStack(): OverlayStackValue   // useContext + null-check

// ---- components/shared/Modal.tsx ----
imports: X icon, useOverlayStack

props: { open, onClose, title?, children }
on open becomes true → push('modal'); on open becomes false or unmount → pop('modal')
if !open → render null
render: overlay markup with X close button

// ---- components/shared/Drawer.tsx ----
same push/pop-on-`open` pattern as Modal, but ALWAYS renders (visibility via data-open/
translate-x, not returning null, so CSS close transitions work)

// ---- components/shared/Toast.tsx ----
imports: CheckCircle2 icon

interface ToastEntry { id, message }
module-level counter: nextId

function ToastProvider({children}):
  state: toasts: ToastEntry[] ← []
  showToast(message) → append {id: nextId++, message}; after ~2.6s remove it again
  render: children + toast stack

function useToast(): { showToast }   // useContext + null-check

// ---- services/authStorage.ts ----
const STORAGE_KEY = 'ceview.auth'
function loadTokens(): AuthTokens | null   // JSON.parse(localStorage.getItem(KEY))
function saveTokens(tokens): void          // localStorage.setItem(KEY, ...)
function clearTokens(): void               // localStorage.removeItem(KEY)

// ---- services/auth.tsx ----
imports: apiClient, {clearTokens, loadTokens, saveTokens} from './authStorage', AuthUser type

interface AuthContextValue { user, isAuthenticated, login(email,pw), register(email,pw), logout() }

function AuthProvider({children}):
  state: user ← null, hydrated ← false
  on mount → if loadTokens() present → set placeholder user {id:'unknown', email:'', businessName:null}
             → hydrated ← true
  login(email,pw) → apiClient.auth.login → saveTokens → setUser(result.user)
  register(email,pw) → same shape as login, via apiClient.auth.register
  logout() → clearTokens() → setUser(null)
  if !hydrated → render null
  render: children wrapped in context provider

function useAuth(): AuthContextValue   // useContext + throws if outside AuthProvider

// ---- components/auth/AuthGate.tsx ----
imports: Navigate, Outlet from 'react-router-dom', useAuth

function AuthGate():
  if !isAuthenticated → redirect to /login
  else → render <Outlet/>

function RedirectIfAuthenticated({children}):
  if isAuthenticated → redirect to /dashboard
  else → render children (wraps LoginPage)

// ---- services/profileContext.tsx ----
imports: createContext/useContext/useState, Navigate/Outlet from 'react-router-dom', BusinessProfile type

const EMPTY_PROFILE: BusinessProfile   // default/empty shape until onboarding completes
interface ProfileContextValue { profile, setProfile }

function ProfileProvider({children}):
  state: profile ← EMPTY_PROFILE
  render: children wrapped in context provider

function useProfile(): ProfileContextValue   // useContext + null-check

function ProfileGate():
  pathname ← window.location.pathname (reads directly, not useLocation())
  if profile.uniquenessScore == null AND pathname !== '/onboarding' → redirect to /onboarding
  if profile.uniquenessScore != null AND pathname === '/onboarding' → redirect to /dashboard
  else → render <Outlet/>

// ---- layout/Sidebar.tsx ----
imports: NavLink, ChevronDown icon, NAV, useAuth

const SETTINGS_TABS: [{tab, label}] for profile/platforms/workspace

function Sidebar():
  { user, logout } ← useAuth()
  state: settingsOpen ← false
  render: NAV's sections/items; NavLink highlights current route; Settings expands inline to
          its 3 sub-tabs (components/settings/, see Card 9, Cards 22-23); footer shows user
          identity + sign-out action (calls logout())

// ---- layout/Topbar.tsx ----
imports: useLocation, Bell/Menu/Search icons, navItemById, NavId type

props: { onToggleSidebar? }
function navIdFromPath(pathname): NavId   // e.g. /settings/profile -> 'settings'

function Topbar({onToggleSidebar}):
  { pathname } ← useLocation()
  navItem ← navItemById(navIdFromPath(pathname))
  render: navItem's title/subtitle, burger button (calls onToggleSidebar), inert notification/search buttons

// ---- layout/AppShell.tsx ----
imports: Outlet, Sidebar, Topbar

function AppShell():
  render: <Sidebar/> + <Topbar/> + <main><Outlet/></main>   // scrollable, beneath topbar

// ---- layout/RoutePlaceholder.tsx ----
imports: navItemById, NavId type

props: { navId?, title?, sub? }
function RoutePlaceholder({navId, title, sub}):
  render: centered "not built yet" message; sources title/sub from navItemById(navId) if not passed explicitly

// ---- components/auth/LoginPage.tsx ----
imports: useState, useAuth

function LoginPage():
  { login, register } ← useAuth()
  state: mode ← 'signin'|'signup', email, password, error, submitting
  on submit → mode === 'signin' ? login(email,password) : register(email,password)
  render: split-pane — brand panel with stat tiles | Sign in/Create account tab switcher +
          email+password form; Google OAuth button rendered but disabled

// ---- App.tsx ----
imports: createBrowserRouter/Navigate/RouterProvider, AuthGate + RedirectIfAuthenticated,
         LoginPage, AppShell, RoutePlaceholder, ProfileProvider + ProfileGate,
         OverlayStackProvider, ToastProvider

function App():
  router ← createBrowserRouter([
    /login → RedirectIfAuthenticated(LoginPage)
    element: AuthGate → children:
      element: ProfileGate → children:
        /onboarding → RoutePlaceholder (no AppShell — wizard internals are a later card)
        element: AppShell → children:
          /dashboard, /content, /calendar, /performance → RoutePlaceholder (each)
          /settings → redirect to /settings/profile
          /settings/:tab → RoutePlaceholder
    * → redirect to /dashboard
  ])
  // Provider nesting: ProfileProvider > OverlayStackProvider > ToastProvider > RouterProvider.
  // AuthProvider is NOT here — it wraps App one level up, in index.tsx.
  render: <ProfileProvider><OverlayStackProvider><ToastProvider>
            <RouterProvider router={router}/>
          </ToastProvider></OverlayStackProvider></ProfileProvider>
