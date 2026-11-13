"use client"

import { Button } from "@/components/Button"

export const PrintReceiptButton = () => (
  <Button variant="outline" className="print:hidden" onPress={() => window.print()}>
    Print receipt
  </Button>
)
