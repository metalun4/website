import ppImg from "../assets/baris.jpg";
import locationImg from "../assets/location_on_white_24dp.svg";
import emailImg from "../assets/email_white_24dp.svg";
import {Socials} from "./Socials.jsx";
import {Section} from "./Section.jsx";
import {Skills} from "./Skills.jsx";

export function Main(){
  const me = {
    "name": "Baris Aydemir",
    "email": "baris@aydemir.website",
    "location": "Izmir, Türkiye",
    "bio": "An experienced Software Developer with a passion for building innovative solutions across web, mobile, " +
      "and industrial automation. My expertise spans full-stack development using React, React Native, Node.js, and C#, " +
      "complemented by strong DevOps skills with Docker and AWS. Certified in TensorFlow and experienced with PyTorch, " +
      "I specialize in integrating machine learning into practical applications that optimize workflows and enhance decision-making."
  }

  return (
      <main className="row m-5 fw-semibold">
        <div className="col-12 col-lg-4 my-5 align-self-center">
          <img src={ppImg} className="rounded pp-img my-2" alt="PP"/>
          <h1 className="d-inline-flex m-0 pb-2 border-bottom">{me.name}</h1>
          <div className="d-flex my-2"><img src={locationImg}/> {me.location}</div>
          <div className="d-flex my-2">
            <a className="text-decoration-none" href={"mailto:" + me.email}><img src={emailImg}/> {me.email}</a>
          </div>
          <Socials/>
        </div>
        <div className="col-12 col-lg-8 border-start border-4">
          <Section sectionTitle={"Summary"}>
            <p className="ps-lg-4">{me.bio}</p>
          </Section>
          <Section sectionTitle={"Skills"}>
            <Skills/>
          </Section>
        </div>
      </main>
  );
}