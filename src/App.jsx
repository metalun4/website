import {Main} from "./components/Main.jsx";
import {Footer} from "./components/Footer.jsx";

import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"

function App() {
  return (
      <>
        <Main/>
        <Footer/>
        <Analytics/>
        <SpeedInsights/>
      </>
  )
}

export default App
