import {Social} from "./Social.jsx";
import githubImg from "../assets/github.svg";
import twitterImg from "../assets/twitter.svg";
import linkedinImg from "../assets/linkedin.svg";
import myResume from "../assets/BarisAydemirResumeWS.pdf";
import resumeImg from "../assets/picture_as_pdf_white_36dp.svg";

export function Socials() {
  const socials = [
    {url: "https://github.com/metalun4/?utm_source=aydemir.website", img: githubImg},
    {url: "https://twitter.com/metalun4/?utm_source=aydemir.website", img: twitterImg},
    {url: "https://linkedin.com/in/barisaydemir/?utm_source=aydemir.website", img: linkedinImg},
    {url: myResume, img: resumeImg},
  ]

  return (
      <div className="d-flex flex-row my-3">
        {socials.map((social, index) => (
            <Social key={index} styleClass={"me-4"} socialUrl={social.url}>
              <img src={social.img}/>
            </Social>
        ))}
      </div>
  );
}