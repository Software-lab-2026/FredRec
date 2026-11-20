import { useTheme } from '../theme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="h-8 w-8 rounded-md text-base text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  )
}
