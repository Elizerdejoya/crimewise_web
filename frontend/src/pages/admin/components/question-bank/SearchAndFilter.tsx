import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchAndFilterProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  courseFilter: string;
  setCourseFilter: (courseId: string) => void;
  courses: any[];
  totalQuestions: number;
  filteredCount: number;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchTerm,
  setSearchTerm,
  courseFilter,
  setCourseFilter,
  courses,
  totalQuestions,
  filteredCount
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search questions..."
            className="w-[250px] pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((course) => (
              <SelectItem key={course.id} value={String(course.id)}>
                {course.code ? `${course.code} - ${course.name}` : course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <span className="text-sm text-muted-foreground">
          {filteredCount} questions found {filteredCount !== totalQuestions && 
            `(filtered from ${totalQuestions})`}
        </span>
      </div>
    </div>
  );
};

export default SearchAndFilter;