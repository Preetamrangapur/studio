import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

interface DataTableProps {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export default function DataTable({ headers, rows, caption }: DataTableProps) {
  if (!headers || headers.length === 0 || !rows) {
    // Allow rows to be empty if headers are present (e.g. table with headers but no data yet)
    // But if headers are missing, it's not a valid table to display.
    // Or if rows are explicitly null/undefined when headers exist.
    return <p className="text-muted-foreground">No structured table data to display, or table format is incorrect.</p>;
  }
  
  if (rows.length === 0 && headers.length > 0) {
     return (
        <>
          <Table>
            {caption && <TableCaption>{caption}</TableCaption>}
            <TableHeader>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead key={index} className="font-semibold">{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
                  No data rows found for the identified headers.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </>
     )
  }


  return (
    <Table>
      {caption && <TableCaption>{caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          {headers.map((header, index) => (
            <TableHead key={index} className="font-semibold">{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell}</TableCell>
            ))}
            {/* If a row has fewer cells than headers, fill with empty cells for consistent layout */}
            {row.length < headers.length &&
              Array.from({ length: headers.length - row.length }).map((_, i) => (
                <TableCell key={`empty-${rowIndex}-${i}`}></TableCell>
              ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
