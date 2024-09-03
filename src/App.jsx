import {Main} from "./components/Main.jsx";
import {Footer} from "./components/Footer.jsx";

import { Analytics } from "@vercel/analytics/react"

function App() {
  return (
      <>
        <Main/>
        <Footer/>
        <Analytics/>
      </>
  )
}

export default App
