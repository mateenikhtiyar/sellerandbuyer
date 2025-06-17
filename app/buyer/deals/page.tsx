"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Eye, LogOut, Briefcase, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"

interface Deal {
  id: string
  title: string
  status: "active" | "pending" | "passed"
  companyDescription: string
  industry: string
  geography: string
  yearsInBusiness: number
  trailingRevenue: number
  trailingEbitda: number
  averageGrowth: number
  netIncome: number
  askingPrice: number
  businessModel: string
  managementPreference: string
  sellerPhone: string
  sellerEmail: string
  documents?: Document[]
}

interface Document {
  id: string
  name: string
  url: string
}

interface BuyerProfile {
  _id: string
  fullName: string
  email: string
  companyName: string
  role: string
  profilePicture: string | null
}

export default function DealsPage() {
  const [activeTab, setActiveTab] = useState("pending")
  const [activeTitle, setActiveTitle] = useState("Pending Deals")
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [profileSubmitted, setProfileSubmitted] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [buyerId, setBuyerId] = useState<string | null>(null)
  const [dealDetailsOpen, setDealDetailsOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  // API functions
  const fetchDealsByStatus = async (status: "pending" | "active" | "passed") => {
    try {
      setLoading(true)
      setApiError(null)
      const token = localStorage.getItem("token")
      if (!token) {
        console.warn("No token found")
        setApiError("Authentication token not found. Please log in again.")
        return []
      }

      const apiUrl = localStorage.getItem("apiUrl") || "https://api.cimamplify.com"

      // Map status to API endpoint
      let endpoint = ""
      switch (status) {
        case "pending":
          endpoint = "/buyers/deals/pending"
          break
        case "active":
          endpoint = "/buyers/deals/active"
          break
        case "passed":
          endpoint = "/buyers/deals/rejected"
          break
      }

      const url = `${apiUrl}${endpoint}`

      console.log(`Fetching ${status} deals from:`, url)
      console.log("Using token:", token.substring(0, 20) + "...")

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Authentication failed - redirecting to login")
          localStorage.removeItem("token")
          localStorage.removeItem("userId")
          router.push("/buyer/login?session=expired")
          return []
        }
        throw new Error(`Failed to fetch ${status} deals: ${response.status}`)
      }

      const data = await response.json()
      console.log(`Raw API response for ${status}:`, data)

      // Map API response to component structure
      const mappedDeals = data.map((deal: any) => {
        const mappedDeal = {
          id: deal._id,
          title: deal.title,
          status: status, // Use the status we're fetching for
          companyDescription: deal.companyDescription,
          industry: deal.industrySector,
          geography: deal.geographySelection,
          yearsInBusiness: deal.yearsInBusiness,
          trailingRevenue: deal.financialDetails?.trailingRevenueAmount || 0,
          trailingEbitda: deal.financialDetails?.trailingEBITDAAmount || 0,
          averageGrowth: deal.financialDetails?.avgRevenueGrowth || 0,
          netIncome: deal.financialDetails?.netIncome || 0,
          askingPrice: deal.financialDetails?.askingPrice || 0,
          businessModel: getBusinessModelString(deal.businessModel),
          managementPreference: getManagementPreferenceString(deal.managementPreferences),
          sellerPhone: "Contact via platform",
          sellerEmail: "Contact via platform",
          documents: deal.documents || [],
        }
        console.log("Mapped deal:", mappedDeal)
        return mappedDeal
      })

      console.log(`All mapped ${status} deals:`, mappedDeals)
      return mappedDeals
    } catch (error) {
      console.error(`Error fetching ${status} deals:`, error)
      setApiError(`Failed to load ${status} deals. Please try again later.`)
      return []
    } finally {
      setLoading(false)
    }
  }

  const fetchAllDeals = async () => {
    try {
      setLoading(true)
      setDeals([]) // <-- Add this line to clear previous deals
      console.log("Fetching all deals...")

      // Fetch deals for all statuses
      const [pendingDeals, activeDeals, passedDeals] = await Promise.all([
        fetchDealsByStatus("pending"),
        fetchDealsByStatus("active"),
        fetchDealsByStatus("passed"),
      ])

      // Combine all deals
      const allDeals = [...pendingDeals, ...activeDeals, ...passedDeals]
      console.log("Combined all deals:", allDeals)

      setDeals(allDeals)
    } catch (error) {
      console.error("Error fetching all deals:", error)
      setApiError("Failed to load deals. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  // Helper functions
  const getBusinessModelString = (businessModel: any) => {
    if (!businessModel) return "Not specified"
    const models = []
    if (businessModel.recurringRevenue) models.push("Recurring Revenue")
    if (businessModel.projectBased) models.push("Project-Based")
    if (businessModel.assetLight) models.push("Asset Light")
    if (businessModel.assetHeavy) models.push("Asset Heavy")
    return models.join(", ") || "Not specified"
  }

  const getManagementPreferenceString = (managementPreferences: any) => {
    if (!managementPreferences) return "Not specified"
    const prefs = []
    if (managementPreferences.retiringDivesting) prefs.push("Retiring/Divesting")
    if (managementPreferences.staffStay) prefs.push("Staff willing to stay")
    return prefs.join(", ") || "Not specified"
  }

  // Update deal status via API
  const updateDealStatus = async (dealId: string, action: "activate" | "reject" | "set-pending") => {
    try {
      console.log(`=== Starting updateDealStatus ===`)
      console.log(`Deal ID: ${dealId}`)
      console.log(`Action: ${action}`)

      setApiError(null)
      const token = localStorage.getItem("token")
      const currentBuyerId = localStorage.getItem("userId")
      const apiUrl = localStorage.getItem("apiUrl") || "https://api.cimamplify.com"

      console.log("Token exists:", !!token)
      console.log("Buyer ID:", currentBuyerId)
      console.log("API URL:", apiUrl)

      if (!token) {
        const errorMsg = "Authentication token not found. Please log in again."
        console.error(errorMsg)
        setApiError(errorMsg)
        return false
      }

      if (!currentBuyerId) {
        const errorMsg = "User ID not found. Please log in again."
        console.error(errorMsg)
        setApiError(errorMsg)
        return false
      }

      let endpoint = ""
      const method = "POST"
      let body: any = {}

      // Use the correct endpoints from your backend
      switch (action) {
        case "activate":
          endpoint = `/buyers/deals/${dealId}/activate`
          body = { notes: "Buyer interested in deal" }
          break
        case "reject":
          endpoint = `/buyers/deals/${dealId}/reject`
          body = { notes: "Deal passed by buyer" }
          break
        case "set-pending":
          endpoint = `/buyers/deals/${dealId}/set-pending`
          body = { notes: "Deal set back to pending" }
          break
        default:
          const errorMsg = `Invalid action: ${action}`
          console.error(errorMsg)
          setApiError(errorMsg)
          return false
      }

      const url = `${apiUrl}${endpoint}`
      console.log(`=== Making API Request ===`)
      console.log(`URL: ${url}`)
      console.log(`Method: ${method}`)
      console.log(`Headers:`, {
        Authorization: `Bearer ${token.substring(0, 20)}...`,
        "Content-Type": "application/json",
      })
      console.log(`Body:`, body)

      const response = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      console.log(`=== API Response ===`)
      console.log(`Status: ${response.status}`)
      console.log(`Status Text: ${response.statusText}`)
      console.log(`OK: ${response.ok}`)

      if (!response.ok) {
        let errorText = ""
        try {
          errorText = await response.text()
          console.error(`API Error Response:`, errorText)
        } catch (e) {
          console.error("Could not read error response:", e)
          errorText = `HTTP ${response.status} ${response.statusText}`
        }

        if (response.status === 401) {
          console.error("Authentication failed during status update - redirecting to login")
          localStorage.removeItem("token")
          localStorage.removeItem("userId")
          router.push("/buyer/login?session=expired")
          return false
        }

        const errorMsg = `Failed to update deal status. Server responded with: ${response.status} - ${errorText}`
        console.error(errorMsg)
        setApiError(errorMsg)
        return false
      }

      let responseData = null
      try {
        responseData = await response.json()
        console.log(`Success Response Data:`, responseData)
      } catch (e) {
        console.log("No JSON response body or failed to parse")
      }

      console.log(`=== Deal ${dealId} successfully updated to ${action} ===`)

      // Show success message
      console.log(`SUCCESS: Deal status updated to ${action}`)

      // Refresh all deals after successful update
      console.log("Refreshing all deals after successful update...")
      await fetchAllDeals()

      return true
    } catch (error) {
      console.error(`=== Error updating deal status to ${action} ===`)
      console.error("Error details:", error)

      const errorMsg = `Failed to update deal status: ${error instanceof Error ? error.message : "Unknown error"}`
      setApiError(errorMsg)
      return false
    }
  }

  // Initialize component
  const initializeComponent = () => {
    console.log("Initializing DealsPage component")

    const urlToken = searchParams?.get("token")
    const urlUserId = searchParams?.get("userId")

    // Handle token from URL or localStorage
    if (urlToken) {
      const cleanToken = urlToken.trim()
      localStorage.setItem("token", cleanToken)
      setAuthToken(cleanToken)
      console.log("Token set from URL:", cleanToken.substring(0, 10) + "...")
    } else {
      const storedToken = localStorage.getItem("token")
      if (storedToken) {
        const cleanToken = storedToken.trim()
        setAuthToken(cleanToken)
        console.log("Token set from localStorage:", cleanToken.substring(0, 10) + "...")
      } else {
        console.warn("No token found, redirecting to login")
        router.push("/buyer/login")
        return false
      }
    }

    // Handle user ID from URL or localStorage
    if (urlUserId) {
      const cleanUserId = urlUserId.trim()
      localStorage.setItem("userId", cleanUserId)
      setBuyerId(cleanUserId)
      console.log("Buyer ID set from URL:", cleanUserId)
    } else {
      const storedUserId = localStorage.getItem("userId")
      if (storedUserId) {
        const cleanUserId = storedUserId.trim()
        setBuyerId(cleanUserId)
        console.log("Buyer ID set from localStorage:", cleanUserId)
      } else {
        console.warn("No user ID found")
      }
    }

    return true
  }

  // Check for token and userId on mount and from URL parameters
  useEffect(() => {
    console.log("DealsPage useEffect triggered")

    setActiveTitle(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Deals`)

    if (searchParams?.get("profileSubmitted") === "true" && !localStorage.getItem("profileSubmissionNotified")) {
      setProfileSubmitted(true)
      localStorage.setItem("profileSubmissionNotified", "true")
      console.log("Profile Submitted: Your company profile has been successfully submitted.")
    }

    if (!isInitialized) {
      const initialized = initializeComponent()
      if (!initialized) return

      setIsInitialized(true)
      checkProfileSubmission()
      fetchBuyerProfile()
      fetchAllDeals()
    }
  }, [searchParams, router, activeTab, isInitialized])

  // Add a separate effect to handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        console.log("Page became visible, refreshing data")
        fetchAllDeals()
        fetchBuyerProfile()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isInitialized])

  const checkProfileSubmission = async () => {
    try {
      const token = localStorage.getItem("token")
      const userId = localStorage.getItem("userId")

      if (!token || !userId) {
        console.warn("Missing token or userId for profile check")
        return
      }

      const apiUrl = localStorage.getItem("apiUrl") || "https://api.cimamplify.com"

      const response = await fetch(`${apiUrl}/company-profiles/my-profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch((error) => {
        console.log("Profile check error:", error)
        return null
      })

      if (!response || !response.ok) {
        console.log("Profile check failed or not supported")
        return
      }

      const data = await response.json()

      if (data && (data.exists === false || data.profileExists === false)) {
        console.log("No profile found, redirecting to profile page")
        router.push("/buyer/acquireprofile")
      }
    } catch (error) {
      console.error("Error checking profile:", error)
    }
  }

  const fetchBuyerProfile = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        console.warn("Missing token for profile fetch")
        return
      }

      const apiUrl = localStorage.getItem("apiUrl") || "https://api.cimamplify.com"

      const response = await fetch(`${apiUrl}/buyers/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token")
          localStorage.removeItem("userId")
          router.push("/buyer/login?session=expired")
          return
        }
        throw new Error(`Failed to fetch buyer profile: ${response.status}`)
      }

      const data = await response.json()
      setBuyerProfile(data)
      console.log("Buyer profile fetched:", data)
    } catch (error) {
      console.error("Error fetching buyer profile:", error)
    }
  }

  const handlePassDeal = async (dealId: string) => {
    console.log("Handling pass deal:", dealId)
    const success = await updateDealStatus(dealId, "reject")

    if (success) {
      console.log("Deal Passed: The deal has been moved to the passed section.")
      setDealDetailsOpen(false)

      // Switch to passed tab to show the deal
      setActiveTab("passed")
      setActiveTitle("Passed Deals")
    }
  }

  const handleViewDealDetails = (deal: Deal) => {
    if (deal.status === "active") {
      setSelectedDeal(deal)
      setDealDetailsOpen(true)
    } else {
      handleGoToCIM(deal.id)
    }
  }

  const handleViewCIMClick = (e: React.MouseEvent, deal: Deal) => {
    e.stopPropagation()

    if (deal.status === "active") {
      handleViewDealDetails(deal)
    } else {
      handleGoToCIM(deal.id)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setActiveTitle(`${tab.charAt(0).toUpperCase() + tab.slice(1)} Deals`)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  const filteredDeals = deals.filter((deal) => {
    // First filter by tab status
    if (deal.status !== activeTab) return false

    // Then filter by search query if one exists
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      return (
        deal.title.toLowerCase().includes(query) ||
        deal.companyDescription.toLowerCase().includes(query) ||
        deal.industry.toLowerCase().includes(query) ||
        deal.geography.toLowerCase().includes(query) ||
        deal.businessModel.toLowerCase().includes(query)
      )
    }

    return true
  })

  const handleGoToCIM = (dealId: string) => {
    setSelectedDealId(dealId)
    setTermsModalOpen(true)
  }

  const handleApproveTerms = async () => {
    setTermsModalOpen(false)

    if (selectedDealId) {
      console.log("Handling approve terms for deal:", selectedDealId)
      const success = await updateDealStatus(selectedDealId, "activate")

      if (success) {
        console.log("Deal Approved: The deal has been moved to the active section.")

        // Switch to active tab to show the deal
        setActiveTab("active")
        setActiveTitle("Active Deals")
      }
    }
  }

  const handleLogout = () => {
    console.log("Logging out")
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    router.push("/buyer/login")
  }

  const getProfilePictureUrl = (path: string | null) => {
    if (!path) return null

    const apiUrl = localStorage.getItem("apiUrl") || "https://api.cimamplify.com"

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path
    }

    const formattedPath = path.replace(/\\/g, "/")
    return `${apiUrl}/${formattedPath.startsWith("/") ? formattedPath.substring(1) : formattedPath}`
  }

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "active":
        return (
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
            <span>Active</span>
          </div>
        )
      case "pending":
        return (
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-orange-500 mr-2"></div>
            <span>Pending</span>
          </div>
        )
      case "passed":
        return (
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-blue-500 mr-2"></div>
            <span>Passed</span>
          </div>
        )
      default:
        return null
    }
  }

  const countDealsByStatus = (status: string) => {
    return deals.filter((deal) => deal.status === status).length
  }

  // Show loading if not initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-10 pt-3 pb-1">
            <Link href="/deals">
              <div className="flex items-center">
                <img src="/logo.svg" alt="CIM Amplify" className="h-10" />
              </div>
            </Link>
            <h1 className="text-2xl font-semibold text-gray-800">{activeTitle}</h1>
            <div className="relative mx-4 ">
              <div className="flex items-center rounded-xl bg-[#3AAFA914] px-3 py-4 ">
                <Search className="ml-2  text-[#3AAFA9] mr-3 font-bold" />
                <input
                  type="text"
                  placeholder="Search deals..."
                  className="bg-transparent text-sm focus:outline-none w-72 "
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              {/* <Bell className="h-5 w-5 text-gray-500" /> */}
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                2
              </div>
            </div>

            <div className="flex items-center">
              <div className="mr-2 text-right">
                <div className="text-sm font-medium">{buyerProfile?.fullName || "User"}</div>
                {/* <div className="text-xs text-gray-500">{buyerProfile?.companyName || "Company"}</div> */}
              </div>
              <div className="relative">
                {buyerProfile?.profilePicture ? (
                  <img
                    src={getProfilePictureUrl(buyerProfile.profilePicture) || "/placeholder.svg"}
                    alt={buyerProfile.fullName}
                    className="h-8 w-8 rounded-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                    }}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-600 text-sm">{buyerProfile?.fullName?.charAt(0) || "U"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-gray-200 bg-white">
          <nav className="flex flex-col p-4">
            <Link
              href="/deals"
              className="mb-2 flex items-center rounded-md bg-teal-500 px-4 py-3 text-white hover:bg-teal-600"
            >
              <Briefcase className="mr-3 h-5 w-5" />
              <span>All Deals</span>
            </Link>

            <Link
              href="/buyer/company-profile"
              className="mb-2 flex items-center rounded-md px-4 py-3 text-gray-700 hover:bg-gray-100"
            >
              <Eye className="mr-3 h-5 w-5" />
              <span>Company Profile</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center rounded-md px-4 py-3 text-gray-700 hover:bg-gray-100 text-left w-full"
            >
              <LogOut className="mr-3 h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-gray-50 p-6">
          {profileSubmitted && (
            <div className="mb-6 rounded-md bg-green-50 p-4 text-green-800 border border-green-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">Your company profile has been successfully submitted!</p>
                </div>
              </div>
            </div>
          )}

          {apiError && (
            <div className="mb-6 rounded-md bg-red-50 p-4 text-red-800 border border-red-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{apiError}</p>
                  <button onClick={() => setApiError(null)} className="text-sm underline mt-1">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Debug and Refresh Section */}
          <div className="mb-4  items-center justify-between hidden">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => {
                  console.log("Manual refresh triggered")
                  fetchAllDeals()
                }}
                variant="outline"
                className="text-sm"
              >
                Refresh Deals
              </Button>
              <div className="text-sm text-gray-500">
                Total deals: {deals.length} | Pending: {countDealsByStatus("pending")} | Active:{" "}
                {countDealsByStatus("active")} | Passed: {countDealsByStatus("passed")}
              </div>
            </div>
            <div className="text-xs text-gray-400">
              Token: {authToken ? `${authToken.substring(0, 10)}...` : "None"} | User ID: {buyerId || "None"}
            </div>

          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6 gap-2">
            <TabsList className="bg-white space-x-4">
              <TabsTrigger
                value="pending"
                className={`relative ${
                  activeTab === "pending" ? "bg-[#3AAFA9] text-white" : "bg-gray-200 text-gray-700"
                } hover:bg-[#3AAFA9] hover:text-white px-6 py-2 rounded-md`}
              >
                Pending ({countDealsByStatus("pending")})
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className={`relative ${
                  activeTab === "active" ? "bg-[#3AAFA9] text-white" : "bg-gray-200 text-gray-700"
                } hover:bg-[#3AAFA9] hover:text-white px-6 py-2 rounded-md`}
              >
                Active ({countDealsByStatus("active")})
              </TabsTrigger>
              <TabsTrigger
                value="passed"
                className={`relative ${
                  activeTab === "passed" ? "bg-[#3AAFA9] text-white" : "bg-gray-200 text-gray-700"
                } hover:bg-[#3AAFA9] hover:text-white px-6 py-2 rounded-md`}
              >
                Passed ({countDealsByStatus("passed")})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-gray-500">Loading deals...</div>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-gray-500">No deals found for this status.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleViewDealDetails(deal)}
                >
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <h3 className="text-lg font-medium text-teal-500">{deal.title}</h3>
                  </div>

                  <div className="p-4">
                    <h4 className="mb-2 font-medium text-gray-800">Overview</h4>
                    <div className="mb-4 space-y-1 text-sm text-gray-600">
                      <p>Company Description: {deal.companyDescription}</p>
                      <p>Industry: {deal.industry}</p>
                      <p>Geography: {deal.geography}</p>
                      <p>Number of Years in Business: {deal.yearsInBusiness}</p>
                      <p>Management Future Preferences: {deal.managementPreference}</p>
                      <p>Business Mode: {deal.businessModel}</p>
                    </div>

                    <h4 className="mb-2 font-medium text-gray-800">Financial</h4>
                    <div className="mb-4 grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <p>Trailing 12-Month Revenue: ${deal.trailingRevenue.toLocaleString()}</p>
                      <p>Trailing 12-Month EBITDA: ${deal.trailingEbitda.toLocaleString()}</p>
                       <p>
                      <span className="font-medium">T12 Free Cash Flow :</span> $
                      425
                    </p>
                    <p>
                      <span className="font-medium">T12 Net Income:</span> $
                      320
                    </p>
                      <p>Average 3-YEAR REVENUE GROWTH IN $: ${deal.averageGrowth.toLocaleString()}</p>
                      <p>Net Income: ${deal.netIncome.toLocaleString()}</p>
                      <p>Asking Price: ${deal.askingPrice.toLocaleString()}</p>
                      
                      
                    </div>

                    {/* <h4 className="mb-2 font-medium text-gray-800">Seller Contact Information</h4>
                    <div className="mb-4 space-y-1 text-sm text-gray-600">
                      <p>Phone Number: {deal.sellerPhone}</p>
                      <p>Email: {deal.sellerEmail}</p>
                    </div> */}

                    <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      <Button onClick={(e) => handleViewCIMClick(e, deal)} className="bg-teal-500 hover:bg-teal-600">
                        {deal.status === "active" ? "View CIM" : "Go to CIM"}
                      </Button>
                      {deal.status !== "passed" && (
                        <Button
                          variant="outline"
                          className="border-red-200 bg-[#E3515333] text-red-500 hover:bg-red-50"
                          onClick={() => handlePassDeal(deal.id)}
                        >
                          Pass
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Terms of Access Modal */}
      <Dialog open={termsModalOpen} onOpenChange={setTermsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Terms of Access</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4 text-sm text-gray-600">
              By clicking "Approve" you reaffirm your previous acceptance of the STRAIGHT TO CIM MASTER NON-DISCLOSURE
              AGREEMENT and the CIM AMPLIFY MASTER FEE AGREEMENT.
            </p>
            <p className="text-sm text-gray-600">
              Once you approve, the seller will be notified and can contact you directly.
            </p>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setTermsModalOpen(false)}>
              Go Back
            </Button>
            <Button onClick={handleApproveTerms} className="bg-teal-500 hover:bg-teal-600">
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Details Modal */}
      <Dialog open={dealDetailsOpen} onOpenChange={setDealDetailsOpen}>
        <DialogContent className="w-[523px] h-[583px] fixed  border-[0.5px] rounded-[6px] p-0 overflow-hidden overflow-y-auto">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-center text-teal-500 text-xl">Deal Details</DialogTitle>
            </DialogHeader>

            {selectedDeal && (
              <div className="py-4">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Overview</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Deal Title:</span> {selectedDeal.title}
                    </p>
                    <p>
                      <span className="font-medium">Company Description:</span> {selectedDeal.companyDescription}
                    </p>
                    <p>
                      <span className="font-medium">Industry:</span> {selectedDeal.industry}
                    </p>
                    <p>
                      <span className="font-medium">Geography:</span> {selectedDeal.geography}
                    </p>
                    <p>
                      <span className="font-medium">Number of Years in Business:</span> {selectedDeal.yearsInBusiness}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Financial</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <p>
                      <span className="font-medium">Trailing 12-Month Revenue:</span> $
                      {selectedDeal.trailingRevenue.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Trailing 12-Month EBITDA:</span> $
                      {selectedDeal.trailingEbitda.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Average 3-YEAR REVENUE GROWTH IN $:</span> $
                      {selectedDeal.averageGrowth.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">T12 Free Cash Flow :</span> $
                      425
                    </p>
                    <p>
                      <span className="font-medium">T12 Net Income:</span> $
                      320
                    </p>
                    <p>
                      <span className="font-medium">Net Income:</span> ${selectedDeal.netIncome.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Asking Price:</span> ${selectedDeal.askingPrice.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Business Model:</span> {selectedDeal.businessModel}
                    </p>
                    <p className="col-span-2">
                      <span className="font-medium">Management Future Preferences:</span>{" "}
                      {selectedDeal.managementPreference}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Seller Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Phone Number:</span> {selectedDeal.sellerPhone}
                    </p>
                    <p>
                      <span className="font-medium">Email:</span> {selectedDeal.sellerEmail}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-4 p-4 mt-auto border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() => setDealDetailsOpen(false)}
              className="border-[#3AAFA9] px-8 py-2 rounded-md bg-[#3AAFA91A] text-[#3AAFA9] hover:text-[#3AAFA9]"
            >
              Close
            </Button>
            {selectedDeal && selectedDeal.status !== "passed" && (
              <Button
                variant="outline"
                className="border-red-200 text-red-500 hover:bg-red-50 px-8 py-2 hover:text-red-500 rounded-md bg-[#E3515333]"
                onClick={() => {
                  if (selectedDeal) {
                    handlePassDeal(selectedDeal.id)
                  }
                }}
              >
                Pass
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
