const projects = [
  {
    title: "Portfolio Website",
    description: "A creative personal site with project storytelling and animated cards.",
    tech: ["HTML", "CSS", "JavaScript"],
    github: "https://github.com/RayyanNoor/portfolio"
  },
  {
    title: "Project Placeholder One",
    description: "Replace this with your real project summary in 1-2 practical lines.",
    tech: ["React", "Node.js", "PostgreSQL"],
    github: "https://github.com/RayyanNoor/project-one"
  },
  {
    title: "Project Placeholder Two",
    description: "Replace this with another project that shows product or engineering depth.",
    tech: ["Python", "FastAPI", "Docker"],
    github: "https://github.com/RayyanNoor/project-two"
  }
];

const grid = document.getElementById("projectGrid");

projects.forEach((project, index) => {
  const card = document.createElement("article");
  card.className = "project-card";
  card.style.animationDelay = `${index * 90}ms`;

  const tags = project.tech.map((t) => `<span class="tag">${t}</span>`).join("");

  card.innerHTML = `
    <h3>${project.title}</h3>
    <p>${project.description}</p>
    <div class="tags">${tags}</div>
    <a class="btn repo" href="${project.github}" target="_blank" rel="noreferrer">View on GitHub</a>
  `;

  grid.appendChild(card);
});
