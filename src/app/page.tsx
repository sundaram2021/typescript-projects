import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Video } from "lucide-react"

export default function HomePage() {
  const projects = [
    {
      id: "video-call",
      title: "Video Calling App",
      description: "A web-based video calling application similar to Google Meet",
      icon: <Video className="h-6 w-6" />,
      technologies: ["Next.js", "WebRTC", "Tailwind CSS"],
      path: "/video-call",
    },
    // More projects can be added here later
  ]

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Next.js Project Hub</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A collection of scalable Next.js projects with modern UI and backend integration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link href={project.path} key={project.id} className="block transition-all hover:scale-[1.02]">
            <Card className="h-full overflow-hidden border-2 hover:border-primary">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-primary/10 rounded-lg">{project.icon}</div>
                </div>
                <CardTitle className="text-xl mt-4">{project.title}</CardTitle>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/50 px-6 py-3">
                <div className="flex justify-between items-center w-full">
                  <span className="text-sm font-medium">View Project</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

