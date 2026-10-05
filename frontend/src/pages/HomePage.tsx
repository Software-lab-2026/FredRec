import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";

const Defaultsuggestions = [
  "Operating Systems",
  "Machine Learning",
  "Computer Netowrks",
  "System Design",
  "Database Management System",
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl pt-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        Learch Computer Science Topics for Free
      </h1>
      <p className="mt-3 text-lg text-slate-600">
        Search any CS topic and find free videos, courses, textbooks, research
        papers and more — all in one place.
      </p>
      <div className="mt-8">
        <SearchBar large />
      </div>
    </div>
  );
}
