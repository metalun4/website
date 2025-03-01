export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
      <footer className="row mt-auto text-white-50 text-center">
        <p>&copy; {currentYear} Baris Aydemir - Find the code on <a target="_blank" href="https://github.com/metalun4/website">GitHub</a>
        </p>
      </footer>
  );
}