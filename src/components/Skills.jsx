import {Skill} from "./Skill.jsx";

export function Skills() {
  const skills = ["Web Development", "Frontend Development", "Backend Development", "JavaScript", "TypeScript",
    "React", "NextJS", "React Native", "NestJS", "SQL","TensorFlow", "Machine Learning", "Computer Vision", "Cloud Development"];

  return (
      <div className="m-2 ps-lg-4 text-center">
        {skills.map((skill, index) => (
            <Skill key={index} skillName={skill}/>
        ))}
      </div>
  );
}