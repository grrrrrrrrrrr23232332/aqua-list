"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"

interface Category {
  id: string
  label: string
  icon: string
}

interface CategoryFilterProps {
  categories: Category[]
  selectedCategory: string
}

export function CategoryFilter({ categories, selectedCategory }: CategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const handleCategoryClick = (categoryId: string) => {
    // Create new URLSearchParams
    const params = new URLSearchParams(searchParams)
    
    // Toggle category
    if (selectedCategory === categoryId) {
      params.delete("category")
    } else {
      params.set("category", categoryId)
    }
    
    // Navigate to the new URL
    router.push(`/bots?${params.toString()}`)
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <Badge 
          key={category.id}
          variant={selectedCategory === category.id ? "default" : "outline"}
          className="cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => handleCategoryClick(category.id)}
        >
          <span className="mr-1">{category.icon}</span>
          {category.label}
        </Badge>
      ))}
    </div>
  )
} 