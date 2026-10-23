import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="pt-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline">Back to search</Link>
    </div>
  )
}
