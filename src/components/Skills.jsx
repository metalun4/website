import {Skill} from "./Skill.jsx";

export function Skills() {
  const skills = ["Python", "Java", "React", "SQL", "Web Development", "Backend Development", "Microservices",
    "TensorFlow", "Machine Learning", "Computer Vision", "Data Pipelines", "Cloud Development"];

  return (
      <div className="m-2 ps-lg-4 text-center">
        {skills.map((skill, index) => (
            <Skill key={index} skillName={skill}/>
        ))}
      </div>
  );
}