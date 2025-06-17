"use client"
import Image from "next/image"
import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { ChevronDown, ChevronRight, Search, ArrowLeft, FileText, X, Download } from "lucide-react"
import { getGeoData, type Continent, type Region, type SubRegion, type GeoData } from "@/lib/geography-data"
import {
  getIndustryData,
  type Sector,
  type IndustryGroup,
  type Industry,
  type SubIndustry,
  type IndustryData,
} from "@/lib/industry-data"
import SellerProtectedRoute from "@/components/seller/protected-route"

interface SellerFormData {
  dealTitle: string
  companyDescription: string
  geographySelections: string[]
  industrySelections: string[]
  yearsInBusiness: number
  trailingRevenue: number
  trailingEBITDA: number
  revenueGrowth: number
  currency: string
  netIncome: number
  askingPrice: number
  businessModels: string[]
  managementPreferences: string[]
  capitalAvailability: string
  minPriorAcquisitions: number
  minTransactionSize: number
  documents: File[]
}

interface GeoItem {
  id: string
  name: string
  path: string
}

interface IndustryItem {
  id: string
  name: string
  path: string
}

// Type for hierarchical selection
interface GeographySelection {
  selectedId: string | null
  selectedName: string | null
}

interface IndustrySelection {
  sectors: Record<string, boolean>
  industryGroups: Record<string, boolean>
  industries: Record<string, boolean>
}

interface DealDocument {
  filename: string
  originalName: string
  path: string
  size: number
  mimetype: string
  uploadedAt: string
}

interface Deal {
  _id: string
  title: string
  companyDescription: string
  dealType?: string
  status: string
  visibility?: string
  industrySector: string
  geographySelection: string
  yearsInBusiness: number
  employeeCount?: number
  financialDetails: {
    trailingRevenueCurrency?: string
    trailingRevenueAmount?: number
    trailingEBITDACurrency?: string
    trailingEBITDAAmount?: number
    avgRevenueGrowth?: number
    netIncome?: number
    askingPrice?: number
    finalSalePrice?: number
  }
  businessModel: {
    recurringRevenue?: boolean
    projectBased?: boolean
    assetLight?: boolean
    assetHeavy?: boolean
  }
  managementPreferences: {
    retiringDivesting?: boolean
    staffStay?: boolean
  }
  buyerFit: {
    capitalAvailability?: string
    minPriorAcquisitions?: number
    minTransactionSize?: number
  }
  targetedBuyers: string[]
  interestedBuyers: string[]
  tags?: string[]
  isPublic: boolean
  isFeatured?: boolean
  stakePercentage?: number
  documents: DealDocument[]
  timeline: {
    createdAt: string
    updatedAt: string
    publishedAt?: string
    completedAt?: string
  }
  invitationStatus?: Map<string, any>
  seller: string
}

// Format number with commas for display
const formatNumberWithCommas = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export default function EditDealPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dealId = searchParams.get("id")

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [geoData, setGeoData] = useState<GeoData | null>(null)
  const [industryData, setIndustryData] = useState<IndustryData | null>(null)
  const [flatGeoData, setFlatGeoData] = useState<GeoItem[]>([])
  const [flatIndustryData, setFlatIndustryData] = useState<IndustryItem[]>([])
  const [geoSearchTerm, setGeoSearchTerm] = useState("")
  const [industrySearchTerm, setIndustrySearchTerm] = useState("")
  const [geoOpen, setGeoOpen] = useState(false)
  const [industryOpen, setIndustryOpen] = useState(false)
  const [selectedReward, setSelectedReward] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [existingDocuments, setExistingDocuments] = useState<DealDocument[]>([])

  // Hierarchical selection state
  const [geoSelection, setGeoSelection] = useState<GeographySelection>({
    selectedId: null,
    selectedName: null,
  })

  const [industrySelection, setIndustrySelection] = useState<IndustrySelection>({
    sectors: {},
    industryGroups: {},
    industries: {},
  })

  // UI state for expanded sections
  const [expandedContinents, setExpandedContinents] = useState<Record<string, boolean>>({})
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({})
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({})
  const [expandedIndustryGroups, setExpandedIndustryGroups] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState<SellerFormData>({
    dealTitle: "",
    companyDescription: "",
    geographySelections: [],
    industrySelections: [],
    yearsInBusiness: 0,
    trailingRevenue: 0,
    trailingEBITDA: 0,
    revenueGrowth: 0,
    currency: "USD($)",
    netIncome: 0,
    askingPrice: 0,
    businessModels: [],
    managementPreferences: [],
    capitalAvailability: "ready",
    minPriorAcquisitions: 0,
    minTransactionSize: 0,
    documents: [],
  })

  // Add to state
  const [dealData, setDealData] = useState<Deal | null>(null)

  // Flatten geography data for searchable dropdown
  const flattenGeoData = (items: Continent[] | Region[] | SubRegion[], parentPath = "", result: GeoItem[] = []) => {
    items.forEach((item) => {
      const path = parentPath ? `${parentPath} > ${item.name}` : item.name
      result.push({ id: item.id, name: item.name, path })

      if ("regions" in item && item.regions) {
        flattenGeoData(item.regions, path, result)
      }
      if ("subRegions" in item && item.subRegions) {
        flattenGeoData(item.subRegions, path, result)
      }
    })
    return result
  }

  // Flatten industry data for searchable dropdown
  const flattenIndustryData = (
    items: Sector[] | IndustryGroup[] | Industry[] | SubIndustry[],
    parentPath = "",
    result: IndustryItem[] = [],
  ) => {
    items.forEach((item) => {
      const path = parentPath ? `${parentPath} > ${item.name}` : item.name
      result.push({ id: item.id, name: item.name, path })

      if ("industryGroups" in item && item.industryGroups) {
        flattenIndustryData(item.industryGroups, path, result)
      }
      if ("industries" in item && item.industries) {
        flattenIndustryData(item.industries, path, result)
      }
      if ("subIndustries" in item && item.subIndustries) {
        flattenIndustryData(item.subIndustries, path, result)
      }
    })
    return result
  }

  // Fetch deal data
  const fetchDealData = async () => {
    if (!dealId) {
      toast({
        title: "Error",
        description: "No deal ID provided",
        variant: "destructive",
      })
      router.push("/seller/dashboard")
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      const apiUrl = localStorage.getItem("apiUrl") || "http://localhost:3001"

      const response = await fetch(`${apiUrl}/deals/${dealId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch deal: ${response.statusText}`)
      }

      const dealData: Deal = await response.json()
      setDealData(dealData) // <-- Add this line

      // Set existing documents
      setExistingDocuments(dealData.documents || [])

      // Set reward level
      setSelectedReward(dealData.visibility || "seed")

      // Map deal data to form data
      setFormData({
        dealTitle: dealData.title || "",
        companyDescription: dealData.companyDescription || "",
        geographySelections: dealData.geographySelection ? [dealData.geographySelection] : [],
        industrySelections: dealData.industrySector ? [dealData.industrySector] : [],
        yearsInBusiness: dealData.yearsInBusiness || 0,
        trailingRevenue: dealData.financialDetails?.trailingRevenueAmount || 0,
        trailingEBITDA: dealData.financialDetails?.trailingEBITDAAmount || 0,
        revenueGrowth: dealData.financialDetails?.avgRevenueGrowth || 0,
        currency: dealData.financialDetails?.trailingRevenueCurrency || "USD($)",
        netIncome: dealData.financialDetails?.netIncome || 0,
        askingPrice: dealData.financialDetails?.askingPrice || 0,
        businessModels: [
          ...(dealData.businessModel?.recurringRevenue ? ["recurring-revenue"] : []),
          ...(dealData.businessModel?.projectBased ? ["project-based"] : []),
          ...(dealData.businessModel?.assetLight ? ["asset-light"] : []),
          ...(dealData.businessModel?.assetHeavy ? ["asset-heavy"] : []),
        ],
        managementPreferences: [
          ...(dealData.managementPreferences?.retiringDivesting ? ["retiring-divesting"] : []),
          ...(dealData.managementPreferences?.staffStay ? ["key-staff-stay"] : []),
        ],
        capitalAvailability: dealData.buyerFit?.capitalAvailability?.includes("Ready") ? "ready" : "need-raise",
        minPriorAcquisitions: dealData.buyerFit?.minPriorAcquisitions || 0,
        minTransactionSize: dealData.buyerFit?.minTransactionSize || 0,
        documents: [],
      })

      // Set geography selection
      if (dealData.geographySelection) {
        setGeoSelection({
          selectedId: null, // We don't have the ID from the API, just the name
          selectedName: dealData.geographySelection,
        })
      }

      // Set industry selection - this is more complex and would require matching names to IDs
      // For now, we'll just display the selected industry in the UI
    } catch (error: any) {
      console.error("Error fetching deal:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load deal data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch geography and industry data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [geoResponse, industryResponse] = await Promise.all([getGeoData(), getIndustryData()])
        setGeoData(geoResponse)
        setIndustryData(industryResponse)

        // Flatten the hierarchical data for searchable dropdowns
        setFlatGeoData(flattenGeoData(geoResponse.continents))
        setFlatIndustryData(flattenIndustryData(industryResponse.sectors))

        // After loading the reference data, fetch the deal data
        await fetchDealData()
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load form data. Please refresh the page.",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchData()

    // Check if user is authenticated
    const token = localStorage.getItem("token")
    const userRole = localStorage.getItem("userRole")

    if (!token || userRole !== "seller") {
      router.push("/seller/login")
    }
  }, [router, dealId])

  // Handle text input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle number input changes
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const value = e.target.value === "" ? 0 : Number.parseFloat(e.target.value)
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  // Handle select changes
  const handleSelectChange = (value: string, fieldName: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  // Handle checkbox changes for business models and management preferences
  const handleCheckboxChange = (
    checked: boolean,
    value: string,
    fieldName: "businessModels" | "managementPreferences",
  ) => {
    setFormData((prev) => {
      if (checked) {
        return { ...prev, [fieldName]: [...prev[fieldName], value] }
      } else {
        return { ...prev, [fieldName]: prev[fieldName].filter((item) => item !== value) }
      }
    })
  }

  // Geography selection handlers
  const selectGeography = (id: string, name: string) => {
    setGeoSelection({
      selectedId: id,
      selectedName: name,
    })

    setFormData((prev) => ({
      ...prev,
      geographySelections: [name],
    }))
  }

  const clearGeographySelection = () => {
    setGeoSelection({
      selectedId: null,
      selectedName: null,
    })

    setFormData((prev) => ({
      ...prev,
      geographySelections: [],
    }))
  }

  const removeCountry = (countryToRemove: string) => {
    clearGeographySelection()
  }

  // Industry selection handlers
  const toggleSector = (sector: Sector) => {
    const newIndustrySelection = { ...industrySelection }
    const isSelected = !industrySelection.sectors[sector.id]

    // Update sector selection
    newIndustrySelection.sectors[sector.id] = isSelected

    // Update all industry groups in this sector
    sector.industryGroups.forEach((group) => {
      newIndustrySelection.industryGroups[group.id] = isSelected

      // Update all industries in this group
      group.industries.forEach((industry) => {
        newIndustrySelection.industries[industry.id] = isSelected
      })
    })

    setIndustrySelection(newIndustrySelection)
    updateIndustriesInFormData(newIndustrySelection)
  }

  const toggleIndustryGroup = (group: IndustryGroup, sector: Sector) => {
    const newIndustrySelection = { ...industrySelection }
    const isSelected = !industrySelection.industryGroups[group.id]

    // Update industry group selection
    newIndustrySelection.industryGroups[group.id] = isSelected

    // Update all industries in this group
    group.industries.forEach((industry) => {
      newIndustrySelection.industries[industry.id] = isSelected
    })

    // Check if all groups in the sector are selected/deselected
    const allGroupsSelected = sector.industryGroups.every((g) =>
      g.id === group.id ? isSelected : newIndustrySelection.industryGroups[g.id],
    )

    const allGroupsDeselected = sector.industryGroups.every((g) =>
      g.id === group.id ? !isSelected : !newIndustrySelection.industryGroups[g.id],
    )

    // Update sector selection based on groups
    if (allGroupsSelected) {
      newIndustrySelection.sectors[sector.id] = true
    } else if (allGroupsDeselected) {
      newIndustrySelection.sectors[sector.id] = false
    }

    setIndustrySelection(newIndustrySelection)
    updateIndustriesInFormData(newIndustrySelection)
  }

  const toggleIndustry = (industry: Industry, group: IndustryGroup, sector: Sector) => {
    const newIndustrySelection = { ...industrySelection }
    const isSelected = !industrySelection.industries[industry.id]

    // Update industry selection
    newIndustrySelection.industries[industry.id] = isSelected

    // Check if all industries in the group are selected/deselected
    const allIndustriesSelected = group.industries.every((i) =>
      i.id === industry.id ? isSelected : newIndustrySelection.industries[i.id],
    )

    const allIndustriesDeselected = group.industries.every((i) =>
      i.id === industry.id ? !isSelected : !newIndustrySelection.industries[i.id],
    )

    // Update group selection based on industries
    if (allIndustriesSelected) {
      newIndustrySelection.industryGroups[group.id] = true
    } else if (allIndustriesDeselected) {
      newIndustrySelection.industryGroups[group.id] = false
    }

    // Check if all groups in the sector are selected/deselected
    const allGroupsSelected = sector.industryGroups.every((g) =>
      g.id === group.id ? newIndustrySelection.industryGroups[g.id] : newIndustrySelection.industryGroups[g.id],
    )

    const allGroupsDeselected = sector.industryGroups.every((g) =>
      g.id === group.id ? !newIndustrySelection.industryGroups[g.id] : !newIndustrySelection.industryGroups[g.id],
    )

    // Update sector selection based on groups
    if (allGroupsSelected) {
      newIndustrySelection.sectors[sector.id] = true
    } else if (allGroupsDeselected) {
      newIndustrySelection.sectors[sector.id] = false
    }

    setIndustrySelection(newIndustrySelection)
    updateIndustriesInFormData(newIndustrySelection)
  }

  // Update the industries array in formData based on the hierarchical selection
  const updateIndustriesInFormData = (selection: IndustrySelection) => {
    if (!industryData) return

    const selectedIndustries: string[] = []

    industryData.sectors.forEach((sector) => {
      const sectorSelected = selection.sectors[sector.id]

      // Check if all industry groups in this sector are selected
      const allGroupsSelected = sector.industryGroups.every((group) => {
        return group.industries.every((industry) => selection.industries[industry.id])
      })

      if (sectorSelected && allGroupsSelected) {
        // If sector is selected and all its groups/industries are selected, send only the sector
        selectedIndustries.push(sector.name)
      } else {
        // Otherwise, check individual groups and industries
        sector.industryGroups.forEach((group) => {
          const groupSelected = selection.industryGroups[group.id]

          // Check if all industries in this group are selected
          const allIndustriesSelected = group.industries.every((industry) => selection.industries[industry.id])

          if (groupSelected && allIndustriesSelected) {
            // If group is selected and all its industries are selected, send only the group
            selectedIndustries.push(group.name)
          } else {
            // Otherwise, send only the selected industries
            group.industries.forEach((industry) => {
              if (selection.industries[industry.id]) {
                selectedIndustries.push(industry.name)
              }
            })
          }
        })
      }
    })

    setFormData((prev) => ({
      ...prev,
      industrySelections: selectedIndustries,
    }))
  }

  const removeIndustry = (industryToRemove: string) => {
    if (!industryData) return

    const newIndustrySelection = { ...industrySelection }
    let found = false

    // Search through all levels to find and unselect the matching item
    industryData.sectors.forEach((sector) => {
      if (sector.name === industryToRemove) {
        newIndustrySelection.sectors[sector.id] = false
        found = true

        // Unselect all children
        sector.industryGroups.forEach((group) => {
          newIndustrySelection.industryGroups[group.id] = false

          group.industries.forEach((industry) => {
            newIndustrySelection.industries[industry.id] = false
          })
        })
      }

      if (!found) {
        sector.industryGroups.forEach((group) => {
          if (group.name === industryToRemove) {
            newIndustrySelection.industryGroups[group.id] = false
            found = true

            // Unselect all children
            group.industries.forEach((industry) => {
              newIndustrySelection.industries[industry.id] = false
            })

            // Check if all groups in the sector are now deselected
            const allGroupsDeselected = sector.industryGroups.every((g) => !newIndustrySelection.industryGroups[g.id])

            if (allGroupsDeselected) {
              newIndustrySelection.sectors[sector.id] = false
            }
          }

          if (!found) {
            group.industries.forEach((industry) => {
              if (industry.name === industryToRemove) {
                newIndustrySelection.industries[industry.id] = false
                found = true

                // Check parent selections
                const allIndustriesDeselected = group.industries.every((i) => !newIndustrySelection.industries[i.id])

                if (allIndustriesDeselected) {
                  newIndustrySelection.industryGroups[group.id] = false

                  const allGroupsDeselected = sector.industryGroups.every(
                    (g) => !newIndustrySelection.industryGroups[g.id],
                  )

                  if (allGroupsDeselected) {
                    newIndustrySelection.sectors[sector.id] = false
                  }
                }
              }
            })
          }
        })
      }
    })

    setIndustrySelection(newIndustrySelection)
    updateIndustriesInFormData(newIndustrySelection)
  }

  // Toggle expansion of UI sections
  const toggleContinentExpansion = (continentId: string) => {
    setExpandedContinents((prev) => ({
      ...prev,
      [continentId]: !prev[continentId],
    }))
  }

  const toggleRegionExpansion = (regionId: string) => {
    setExpandedRegions((prev) => {
      const newState = {
        ...prev,
        [regionId]: !prev[regionId],
      }
      return newState
    })
  }

  const toggleSectorExpansion = (sectorId: string) => {
    setExpandedSectors((prev) => ({
      ...prev,
      [sectorId]: !prev[sectorId],
    }))
  }

  const toggleIndustryGroupExpansion = (groupId: string) => {
    setExpandedIndustryGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // Filter geography data based on search term
  const filterGeographyData = () => {
    if (!geoData || !geoSearchTerm) return geoData

    const filteredContinents: Continent[] = []

    geoData.continents.forEach((continent) => {
      const filteredRegions = continent.regions.filter((region) =>
        region.name.toLowerCase().includes(geoSearchTerm.toLowerCase()),
      )

      if (filteredRegions.length > 0) {
        filteredContinents.push({
          ...continent,
          regions: filteredRegions,
        })
      }
    })

    return { continents: filteredContinents }
  }

  // Filter industry data based on search term
  const filterIndustryData = () => {
    if (!industryData || !industrySearchTerm) return industryData

    const filteredSectors: Sector[] = []

    industryData.sectors.forEach((sector) => {
      const filteredGroups: IndustryGroup[] = []

      sector.industryGroups.forEach((group) => {
        const filteredIndustries: Industry[] = []

        group.industries.forEach((industry) => {
          if (industry.name.toLowerCase().includes(industrySearchTerm.toLowerCase())) {
            filteredIndustries.push(industry)
          }
        })

        if (filteredIndustries.length > 0 || group.name.toLowerCase().includes(industrySearchTerm.toLowerCase())) {
          filteredGroups.push({
            ...group,
            industries: filteredIndustries.length > 0 ? filteredIndustries : group.industries,
          })
        }
      })

      if (filteredGroups.length > 0 || sector.name.toLowerCase().includes(industrySearchTerm.toLowerCase())) {
        filteredSectors.push({
          ...sector,
          industryGroups: filteredGroups.length > 0 ? filteredGroups : sector.industryGroups,
        })
      }
    })

    return { sectors: filteredSectors }
  }

  // Render the hierarchical geography selection
  const renderGeographySelection = () => {
    const filteredData = filterGeographyData()
    if (!filteredData) return <div>Loading geography data...</div>

    return (
      <div className="space-y-2 font-poppins">
        {filteredData.continents.map((continent) => (
          <div key={continent.id} className="border-b border-gray-100 pb-1">
            <div className="flex items-center">
              <input
                type="radio"
                id={`continent-${continent.id}`}
                name="geography"
                checked={geoSelection.selectedId === continent.id}
                onChange={() => selectGeography(continent.id, continent.name)}
                className="mr-2 h-4 w-4 text-[#3aafa9] focus:ring-[#3aafa9]"
              />
              <div
                className="flex items-center cursor-pointer flex-1"
                onClick={() => toggleContinentExpansion(continent.id)}
              >
                {expandedContinents[continent.id] ? (
                  <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
                )}
                <Label htmlFor={`continent-${continent.id}`} className="text-[#344054] cursor-pointer font-medium">
                  {continent.name}
                </Label>
              </div>
            </div>

            {expandedContinents[continent.id] && (
              <div className="ml-6 mt-1 space-y-1">
                {continent.regions.map((region) => (
                  <div key={region.id} className="pl-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={`region-${region.id}`}
                        name="geography"
                        checked={geoSelection.selectedId === region.id}
                        onChange={() => selectGeography(region.id, region.name)}
                        className="mr-2 h-4 w-4 text-[#3aafa9] focus:ring-[#3aafa9]"
                      />
                      {region.subRegions && region.subRegions.length > 0 ? (
                        <div
                          className="flex items-center cursor-pointer flex-1"
                          onClick={() => toggleRegionExpansion(region.id)}
                        >
                          {expandedRegions[region.id] ? (
                            <ChevronDown className="h-3 w-3 mr-1 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-3 w-3 mr-1 text-gray-400" />
                          )}
                          <Label htmlFor={`region-${region.id}`} className="text-[#344054] cursor-pointer">
                            {region.name}
                          </Label>
                        </div>
                      ) : (
                        <Label htmlFor={`region-${region.id}`} className="text-[#344054] cursor-pointer">
                          {region.name}
                        </Label>
                      )}
                    </div>

                    {region.subRegions && expandedRegions[region.id] && (
                      <div className="ml-6 mt-1 space-y-1">
                        {region.subRegions.map((subRegion) => (
                          <div key={subRegion.id} className="flex items-center">
                            <input
                              type="radio"
                              id={`subregion-${subRegion.id}`}
                              name="geography"
                              checked={geoSelection.selectedId === subRegion.id}
                              onChange={() => selectGeography(subRegion.id, subRegion.name)}
                              className="mr-2 h-4 w-4 text-[#3aafa9] focus:ring-[#3aafa9]"
                            />
                            <Label
                              htmlFor={`subregion-${subRegion.id}`}
                              className="text-[#344054] cursor-pointer text-sm"
                            >
                              {subRegion.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Render the hierarchical industry selection
  const renderIndustrySelection = () => {
    const filteredData = filterIndustryData()
    if (!filteredData) return <div>Loading industry data...</div>

    return (
      <div className="space-y-2">
        {filteredData.sectors.map((sector) => (
          <div key={sector.id} className="border-b border-gray-100 pb-1">
            <div className="flex items-center">
              <Checkbox
                id={`sector-${sector.id}`}
                checked={!!industrySelection.sectors[sector.id]}
                onCheckedChange={() => {
                  toggleSector(sector)
                }}
                className="mr-2 border-[#d0d5dd]"
              />
              <div className="flex items-center cursor-pointer flex-1" onClick={() => toggleSectorExpansion(sector.id)}>
                {expandedSectors[sector.id] ? (
                  <ChevronDown className="h-4 w-4 mr-1 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-1 text-gray-500" />
                )}
                <Label htmlFor={`sector-${sector.id}`} className="text-[#344054] cursor-pointer font-medium">
                  {sector.name}
                </Label>
              </div>
            </div>

            {expandedSectors[sector.id] && (
              <div className="ml-6 mt-1 space-y-1">
                {sector.industryGroups.map((group) => (
                  <div key={group.id} className="pl-2">
                    <div className="flex items-center">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={!!industrySelection.industryGroups[group.id]}
                        onCheckedChange={() => {
                          toggleIndustryGroup(group, sector)
                        }}
                        className="mr-2 border-[#d0d5dd]"
                      />
                      <div
                        className="flex items-center cursor-pointer flex-1"
                        onClick={() => toggleIndustryGroupExpansion(group.id)}
                      >
                        {expandedIndustryGroups[group.id] ? (
                          <ChevronDown className="h-3 w-3 mr-1 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 mr-1 text-gray-400" />
                        )}
                        <Label htmlFor={`group-${group.id}`} className="text-[#344054] cursor-pointer">
                          {group.name}
                        </Label>
                      </div>
                    </div>

                    {expandedIndustryGroups[group.id] && (
                      <div className="ml-6 mt-1 space-y-1">
                        {group.industries.map((industry) => (
                          <div key={industry.id} className="flex items-center">
                            <Checkbox
                              id={`industry-${industry.id}`}
                              checked={!!industrySelection.industries[industry.id]}
                              onCheckedChange={() => {
                                toggleIndustry(industry, group, sector)
                              }}
                              className="mr-2 border-[#d0d5dd]"
                            />
                            <Label
                              htmlFor={`industry-${industry.id}`}
                              className="text-[#344054] cursor-pointer text-sm"
                            >
                              {industry.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: File[] = []
      let hasError = false

      // Check each file
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i]

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          setFileError(`File ${file.name} exceeds 10MB limit`)
          hasError = true
          break
        }

        newFiles.push(file)
      }

      if (!hasError) {
        setSelectedFile(e.target.files[0]) // Show first file name for UI
        setFileError(null)

        // Add to documents array
        setFormData((prev) => ({
          ...prev,
          documents: [...prev.documents, ...newFiles],
        }))
      }
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dealId) {
      toast({
        title: "Error",
        description: "No deal ID provided",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      // Validate form
      if (!formData.dealTitle.trim()) throw new Error("Deal title is required")
      if (!formData.companyDescription.trim()) throw new Error("Company description is required")
      if (formData.geographySelections.length === 0) throw new Error("Please select a geography")
      if (formData.industrySelections.length === 0) throw new Error("Please select at least one industry")

      // Get token and sellerId from localStorage
      const token = localStorage.getItem("token")
      const sellerId = localStorage.getItem("userId")
      const apiUrl = localStorage.getItem("apiUrl") || "http://localhost:3001"

      if (!token || !sellerId) throw new Error("Authentication required")

      // Map business models to booleans
      const businessModel = {
        recurringRevenue: formData.businessModels.includes("recurring-revenue"),
        projectBased: formData.businessModels.includes("project-based"),
        assetLight: formData.businessModels.includes("asset-light"),
        assetHeavy: formData.businessModels.includes("asset-heavy"),
      }

      // Map management preferences to booleans
      const managementPreferences = {
        retiringDivesting: formData.managementPreferences.includes("retiring-divesting"),
        staffStay: formData.managementPreferences.includes("key-staff-stay"),
      }

      // Compose the payload
      const payload = {
        title: formData.dealTitle,
        companyDescription: formData.companyDescription,
        visibility: selectedReward || "seed",
        industrySector: formData.industrySelections[0] || "",
        geographySelection: formData.geographySelections[0] || "",
        yearsInBusiness: formData.yearsInBusiness,
        financialDetails: {
          trailingRevenueCurrency: formData.currency,
          trailingRevenueAmount: formData.trailingRevenue,
          trailingEBITDACurrency: formData.currency,
          trailingEBITDAAmount: formData.trailingEBITDA,
          avgRevenueGrowth: formData.revenueGrowth,
          netIncome: formData.netIncome,
          askingPrice: formData.askingPrice,
        },
        businessModel,
        managementPreferences,
        buyerFit: {
          capitalAvailability:
            formData.capitalAvailability === "ready" ? "Ready to deploy immediately" : "Need to raise",
          minPriorAcquisitions: formData.minPriorAcquisitions,
          minTransactionSize: formData.minTransactionSize,
        },
        dealType: dealData?.dealType || "acquisition", // <-- Add this line
        status: dealData?.status || "draft",           // <-- Add this line
      }

      console.log("Updating deal payload:", payload)

      // Submit to API
      const response = await fetch(`${apiUrl}/deals/${dealId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to update deal: ${response.statusText}`)
      }

      // Handle document uploads if there are any new documents
      if (formData.documents.length > 0) {
        const uploadFormData = new FormData()

        Array.from(formData.documents).forEach((file) => {
          uploadFormData.append("files", file)
        })

        const uploadResponse = await fetch(`${apiUrl}/deals/${dealId}/upload-documents`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload documents: ${uploadResponse.statusText}`)
        }
      }

      toast({
        title: "Success",
        description: "Your deal has been updated successfully.",
      })

      setTimeout(() => {
        router.push("/seller/dashboard")
      }, 2000)
    } catch (error: any) {
      console.error("Form submission error:", error)
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update deal. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle document download
  const handleDocumentDownload = (doc: DealDocument) => {
    const apiUrl = localStorage.getItem("apiUrl") || "http://localhost:3001"
    const link = document.createElement("a")
    link.href = `${apiUrl}/uploads/deal-documents/${doc.filename}`
    link.download = doc.originalName
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle document deletion
  const handleDocumentDelete = async (doc: DealDocument) => {
    if (!dealId) return

    try {
      const token = localStorage.getItem("token")
      const apiUrl = localStorage.getItem("apiUrl") || "http://localhost:3001"

      const docIndex = existingDocuments.findIndex((d) => d.filename === doc.filename)
      const response = await fetch(`${apiUrl}/deals/${dealId}/documents/${docIndex}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`)
      }

      // Remove from existing documents
      setExistingDocuments(existingDocuments.filter((d) => d.filename !== doc.filename))

      toast({
        title: "Document deleted",
        description: `${doc.originalName} has been deleted successfully.`,
      })
    } catch (error: any) {
      console.error("Error deleting document:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3aafa9]"></div>
      </div>
    )
  }

  return (
    <SellerProtectedRoute>
      <div className="container mx-auto py-8 px-4 max-w-5xl bg-white">
        {/* Header with back button */}
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" className="mr-4" onClick={() => router.push("/seller/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Deal</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Seller Rewards */}
          <div className="bg-[#f0f7fa] p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Seller Rewards - Choose Reward Level</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Seed Option */}
              <Card
                className={`cursor-pointer border ${selectedReward === "seed" ? "border-[#3aafa9]" : "border-gray-200"} overflow-hidden`}
                onClick={() => setSelectedReward("seed")}
              >
                <div className="flex flex-col h-full">
                  <div className="p-4">
                    <div className=" flex justify-between overflow-hidden">
                      <h3 className="font-semibold  text-[#3aafa9]">Seed</h3>

                      <Image width={100} height={100} src="/seed.svg" alt="seed" className="w-20 h-20 " />
                    </div>{" "}
                    <p className="text-sm mt-2 text-gray-600">
                      This deal will be marketed solely on other deal sites. Most of our buyers chase deals from this
                      level.
                    </p>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center">
                      <div className="p-4">
                        <div className="bg-[#3aafa9] text-white text-xs rounded-md px-3 py-3 inline-block">
                          <span className="text-[#F4E040]">$10</span> Amazon Gift Card for posting with us
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Bloom Option */}
              <Card
                className={`cursor-pointer border ${selectedReward === "bloom" ? "border-[#3aafa9]" : "border-gray-200"} overflow-hidden`}
                onClick={() => setSelectedReward("bloom")}
              >
                <div className="flex flex-col h-full">
                  <div className="p-4">
                    <div className=" flex justify-between overflow-hidden">
                      <h3 className="font-semibold  text-[#3aafa9]">Bloom</h3>

                      <Image width={100} height={100} src="/bloom.svg" alt="bloom" className="w-20 h-20 " />
                    </div>{" "}
                    <p className="text-sm mt-2 text-gray-600">
                      Give CIM Amplify a two week head start! This deal will be posted exclusively on CIM Amplify for
                      two weeks and no other deal sites including your own website. Feel free to market directly to
                      buyers you do not choose on CIM Amplify.
                    </p>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center">
                      <div className="p-4">
                        <div className="bg-[#3aafa9] text-white text-xs rounded-md px-3 py-3 inline-block">
                          <span className="text-[#F4E040]"> $25</span> Amazon Gift Card for posting with us PLUS $5 if
                          acquired via CIM Amplify
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Fruit Option */}
              <Card
                className={`cursor-pointer border ${selectedReward === "fruit" ? "border-[#3aafa9]" : "border-gray-200"} overflow-hidden`}
                onClick={() => setSelectedReward("fruit")}
              >
                <div className="flex flex-col h-full">
                  <div className="p-4">
                    <div className=" flex justify-between overflow-hidden">
                      <h3 className="font-semibold  text-[#3aafa9]">Fruit</h3>

                      <Image width={100} height={100} src="/fruit.svg" alt="Fruit" className="w-20 h-20 " />
                    </div>

                    <p className="text-sm mt-2 text-gray-600">
                      This deal will be posted exclusively on CIM Amplify and no other deal sites including your own
                      website. Feel free to market directly to buyers you do not choose on CIM Amplify.
                    </p>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between items-center">
                      <div className="p-4">
                        <div className="bg-[#3aafa9] text-white text-xs rounded-md px-3 py-3 inline-block">
                          <span className="text-[#F4E040]">$50</span> Amazon Gift Card for posting with us PLUS $10 if
                          acquired via CIM Amplify
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Overview Section */}
          <section>
            <h2 className="text-xl font-semibold mb-6">Overview</h2>

            <div className="space-y-6">
              <div>
                <label htmlFor="dealTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Deal Title
                </label>
                <Input
                  id="dealTitle"
                  name="dealTitle"
                  value={formData.dealTitle}
                  onChange={handleInputChange}
                  placeholder="Add title"
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="companyDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Description
                </label>
                <Textarea
                  id="companyDescription"
                  name="companyDescription"
                  value={formData.companyDescription}
                  onChange={handleInputChange}
                  placeholder="Make sure to be very specific about what the company does"
                  className="w-full min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Geography Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Geography Selector</label>
                  <div className="border border-[#d0d5dd] rounded-md p-4 h-80 flex flex-col">
                    <div className="relative mb-4">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#667085]" />
                      <Input
                        placeholder="Search countries..."
                        className="pl-8 border-[#d0d5dd]"
                        value={geoSearchTerm}
                        onChange={(e) => setGeoSearchTerm(e.target.value)}
                      />
                    </div>

                    {formData.geographySelections.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-[#667085] mb-1">Selected Countries</div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {formData.geographySelections.map((country, index) => (
                            <span
                              key={`selected-country-${index}`}
                              className="bg-gray-100 text-[#344054] text-xs rounded-full px-2 py-0.5 flex items-center group"
                            >
                              {country}
                              <button
                                type="button"
                                onClick={() => removeCountry(country)}
                                className="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto">{renderGeographySelection()}</div>
                  </div>
                </div>

                {/* Industry Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Industry Selector</label>
                  <div className="border border-[#d0d5dd] rounded-md p-4 h-80 flex flex-col">
                    <div className="relative mb-4">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#667085]" />
                      <Input
                        placeholder="Search industries..."
                        className="pl-8 border-[#d0d5dd]"
                        value={industrySearchTerm}
                        onChange={(e) => setIndustrySearchTerm(e.target.value)}
                      />
                    </div>

                    {formData.industrySelections.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-[#667085] mb-1">Selected Industries</div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                          {formData.industrySelections.map((industry, index) => (
                            <span
                              key={`selected-industry-${index}`}
                              className="bg-gray-100 text-[#344054] text-xs rounded-full px-2 py-0.5 flex items-center group"
                            >
                              {industry}
                              <button
                                type="button"
                                onClick={() => removeIndustry(industry)}
                                className="ml-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto">{renderIndustrySelection()}</div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of years in business
                </label>
                <Input
                  id="yearsInBusiness"
                  type="number"
                  min="0"
                  value={formData.yearsInBusiness || ""}
                  onChange={(e) => handleNumberChange(e, "yearsInBusiness")}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          {/* Financials Section */}
          <section className="bg-[#f9f9f9] p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-6">Financials</h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="trailingRevenue" className="block text-sm font-medium text-gray-700 mb-1">
                    Trailing 12 Month Revenue
                  </label>
                  <div className="flex">
                    <Input
                      id="trailingRevenue"
                      type="text"
                      value={formData.trailingRevenue ? formatNumberWithCommas(formData.trailingRevenue) : ""}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/,/g, "")
                        if (rawValue === "" || /^-?\d*$/.test(rawValue)) {
                          handleNumberChange(
                            { target: { value: rawValue } } as React.ChangeEvent<HTMLInputElement>,
                            "trailingRevenue",
                          )
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <Select value={formData.currency} onValueChange={(value) => handleSelectChange(value, "currency")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD($)">USD($)</SelectItem>
                      <SelectItem value="EUR(€)">EUR(€)</SelectItem>
                      <SelectItem value="GBP(£)">GBP(£)</SelectItem>
                      <SelectItem value="CAD($)">CAD($)</SelectItem>
                      <SelectItem value="AUD($)">AUD($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="trailingEBITDA" className="block text-sm font-medium text-gray-700 mb-1">
                    Trailing 12 Month EBITDA
                  </label>
                  <Input
                    id="trailingEBITDA"
                    type="text"
                    value={formData.trailingEBITDA ? formatNumberWithCommas(formData.trailingEBITDA) : ""}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/,/g, "")
                      if (rawValue === "" || /^-?\d*$/.test(rawValue)) {
                        handleNumberChange(
                          { target: { value: rawValue } } as React.ChangeEvent<HTMLInputElement>,
                          "trailingEBITDA",
                        )
                      }
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label htmlFor="revenueGrowth" className="block text-sm font-medium text-gray-700 mb-1">
                    Average 3 year revenue growth in %
                  </label>
                  <Input
                    id="revenueGrowth"
                    type="text"
                    value={formData.revenueGrowth ? formatNumberWithCommas(formData.revenueGrowth) : ""}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/,/g, "")
                      if (rawValue === "" || /^-?\d*$/.test(rawValue)) {
                        handleNumberChange(
                          { target: { value: rawValue } } as React.ChangeEvent<HTMLInputElement>,
                          "revenueGrowth",
                        )
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Optional Financial Information */}
          <section className="bg-[#f9f9f9] p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-6">Optional Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="netIncome" className="block text-sm font-medium text-gray-700 mb-1">
                  Net Income
                </label>
                <Input
                  id="netIncome"
                  type="text"
                  value={formData.netIncome ? formatNumberWithCommas(formData.netIncome) : ""}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, "")
                    if (rawValue === "" || /^-?\d*$/.test(rawValue)) {
                      handleNumberChange(
                        { target: { value: rawValue } } as React.ChangeEvent<HTMLInputElement>,
                        "netIncome",
                      )
                    }
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="askingPrice" className="block text-sm font-medium text-gray-700 mb-1">
                  Asking Price
                </label>
                <Input
                  id="askingPrice"
                  type="text"
                  value={formData.askingPrice ? formatNumberWithCommas(formData.askingPrice) : ""}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, "")
                    if (rawValue === "" || /^-?\d*$/.test(rawValue)) {
                      handleNumberChange(
                        { target: { value: rawValue } } as React.ChangeEvent<HTMLInputElement>,
                        "askingPrice",
                      )
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Business Models</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center">
                  <Checkbox
                    id="recurring-revenue"
                    checked={formData.businessModels.includes("recurring-revenue")}
                    onCheckedChange={(checked) => handleCheckboxChange(checked, "recurring-revenue", "businessModels")}
                    className="mr-2 border-[#d0d5dd]"
                  />
                  <Label htmlFor="recurring-revenue" className="cursor-pointer">
                    Recurring Revenue
                  </Label>
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="project-based"
                    checked={formData.businessModels.includes("project-based")}
                    onCheckedChange={(checked) => handleCheckboxChange(checked, "project-based", "businessModels")}
                    className="mr-2 border-[#d0d5dd]"
                  />
                  <Label htmlFor="project-based" className="cursor-pointer">
                    Project Based
                  </Label>
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="asset-light"
                    checked={formData.businessModels.includes("asset-light")}
                    onCheckedChange={(checked) => handleCheckboxChange(checked, "asset-light", "businessModels")}
                    className="mr-2 border-[#d0d5dd]"
                  />
                  <Label htmlFor="asset-light" className="cursor-pointer">
                    Asset Light
                  </Label>
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="asset-heavy"
                    checked={formData.businessModels.includes("asset-heavy")}
                    onCheckedChange={(checked) => handleCheckboxChange(checked, "asset-heavy", "businessModels")}
                    className="mr-2 border-[#d0d5dd]"
                  />
                  <Label htmlFor="asset-heavy" className="cursor-pointer">
                    Asset Heavy
                  </Label>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Management Preferences</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Checkbox
                    id="retiring-divesting"
                    checked={formData.managementPreferences.includes("retiring-divesting")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(checked, "retiring-divesting", "managementPreferences")
                    }
                    className="mr-2 border-[#d0d5dd]"
                  />
                  <Label htmlFor="retiring-divesting" className="cursor-pointer">
                    Retiring / Divesting
                  </Label>
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="key-staff-stay"
                    checked={formData.managementPreferences.includes("key-staff-stay")}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(checked, "key-staff-stay", "managementPreferences")
                    }
                    className="mr-2 border-[#d0d5dd]"
                  />
                  <Label htmlFor="key-staff-stay" className="cursor-pointer">
                    Key Staff Stay
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="capitalAvailability" className="block text-sm font-medium text-gray-700 mb-1">
                  Capital Availability
                </label>
                <Select
                  value={formData.capitalAvailability}
                  onValueChange={(value) => handleSelectChange(value, "capitalAvailability")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready">Ready to deploy immediately</SelectItem>
                    <SelectItem value="need-raise">Need to raise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="minPriorAcquisitions" className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Prior Acquisitions
                </label>
                <Input
                  id="minPriorAcquisitions"
                  type="number"
                  min="0"
                  value={formData.minPriorAcquisitions || ""}
                  onChange={(e) => handleNumberChange(e, "minPriorAcquisitions")}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label htmlFor="minTransactionSize" className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Transaction Size
              </label>
              <Input
                id="minTransactionSize"
                type="number"
                min="0"
                value={formData.minTransactionSize || ""}
                onChange={(e) => handleNumberChange(e, "minTransactionSize")}
                className="w-full"
              />
            </div>
          </section>

          {/* Documents Section */}
          <section className="bg-[#f9f9f9] p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-6">Documents</h2>

            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Existing Documents</h3>
                <ul className="space-y-2">
                  {existingDocuments.map((doc) => (
                    <li key={doc.filename} className="flex items-center justify-between border rounded-md p-3">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-gray-500" />
                        <span className="text-sm text-gray-700">{doc.originalName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => handleDocumentDownload(doc)}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDocumentDelete(doc)}>
                          <X className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Upload New Documents */}
            <div>
              <label htmlFor="documents" className="block text-sm font-medium text-gray-700 mb-1">
                Upload New Documents
              </label>
              <Input
                id="documents"
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full"
                ref={fileInputRef}
              />
              {fileError && <p className="text-red-500 text-sm mt-1">{fileError}</p>}
              {selectedFile && <p className="text-green-500 text-sm mt-1">Selected file: {selectedFile.name}</p>}
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  Updating...
                  <div className="animate-spin rounded-full h-4 w-4 ml-2 border-t-2 border-b-2 border-white"></div>
                </>
              ) : (
                "Update Deal"
              )}
            </Button>
          </div>
        </form>
      </div>
      <Toaster />
    </SellerProtectedRoute>
  )
}
