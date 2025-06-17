"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSellerProfile } from "@/services/api"
import { Pencil, HandshakeIcon, History, LogOut, Eye, EyeOff, Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import SellerProtectedRoute from "@/components/seller/protected-route"

interface SellerProfile {
  id: string
  fullName: string
  email: string
  phoneNumber?: string
  title?: string
  companyName?: string
  website?: string
  location?: string
  profilePicture?: string
}

// Define which fields are editable based on backend DTO
const EDITABLE_FIELDS = ["fullName", "email", "companyName", "phoneNumber"] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

export default function ViewProfilePage() {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState<Partial<SellerProfile>>({})
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [updating, setUpdating] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const router = useRouter()
  const { logout } = useAuth()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper function to get profile picture URL
  const getProfilePictureUrl = (profilePicture: string | null) => {
    if (!profilePicture) return null
    // If it's already a full URL, return as is
    if (profilePicture.startsWith("http")) return profilePicture
    // Otherwise, construct the full URL
    const apiUrl = localStorage.getItem("apiUrl") || "http://localhost:3001"
    // Replace backslashes with forward slashes for URL compatibility
    const formattedPath = profilePicture.replace(/\\/g, "/")
    // Check if path already starts with a slash
    return `${apiUrl}/${formattedPath.startsWith("/") ? formattedPath.substring(1) : formattedPath}`
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const fetchProfile = async () => {
      try {
        setLoading(true)

        const token = localStorage.getItem("token")
        if (!token) {
          console.error("View Profile - No authentication token found, redirecting to login")
          router.push("/seller/login?error=no_token")
          return
        }

        console.log("View Profile - Attempting to fetch profile")
        const data = await getSellerProfile()
        console.log("Profile data:", data)
        setProfile(data)
        setEditValues(data)
        setError(null)
      } catch (err: any) {
        console.error("Error fetching profile:", err)
        setError(err.message || "Failed to load profile")
        toast({
          title: "Error",
          description: err.message || "Failed to load profile",
          variant: "destructive",
        })

        if (
          err.message === "Authentication expired" ||
          err.message === "No authentication token found" ||
          err.message === "Failed to fetch profile: 403"
        ) {
          console.log("View Profile - Authentication error, redirecting to login")
          router.push("/seller/login?error=auth_failed")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [router])

  const handleEditToggle = () => {
    if (editMode) {
      // Reset values when canceling
      setEditValues(profile || {})
    }
    setEditMode(!editMode)
  }

  const handleSaveAll = async () => {
    try {
      setUpdating(true)
      const token = localStorage.getItem("token")

      // Always send all editable fields
      const updatePayload: any = {
        fullName: editValues.fullName?.trim() || "",
        email: editValues.email?.trim() || "",
        companyName: editValues.companyName?.trim() || "",
        phoneNumber: editValues.phoneNumber?.trim() || "",
      }

      const response = await fetch("http://localhost:3001/sellers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update profile")
      }

      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      setEditValues(updatedProfile)
      setEditMode(false)

      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
    } catch (error: any) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const changePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      })
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdating(true)
      const token = localStorage.getItem("token")

      // Send all editable fields + password
      const updatePayload: any = {
        fullName: editValues.fullName?.trim() || profile?.fullName || "",
        email: editValues.email?.trim() || profile?.email || "",
        companyName: editValues.companyName?.trim() || profile?.companyName || "",
        phoneNumber: editValues.phoneNumber?.trim() || profile?.phoneNumber || "",
        password: passwordData.newPassword,
      }

      const response = await fetch("http://localhost:3001/sellers/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to change password")
      }

      setIsPasswordDialogOpen(false)
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })

      toast({
        title: "Success",
        description: "Password changed successfully",
      })
    } catch (error: any) {
      console.error("Error changing password:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|gif)/i)) {
      toast({
        title: "Invalid file type",
        description: "Only image files (JPG, JPEG, PNG, GIF) are allowed.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size should not exceed 5MB.",
        variant: "destructive",
      })
      return
    }

    setUploadingImage(true)
    setUploadError(null)

    try {
      const token = localStorage.getItem("token")

      // Get API URL from localStorage or use default
      const apiUrl = localStorage.getItem("apiUrl") || "http://localhost:3001"

      // Create form data with 'file' as the field name
      const formData = new FormData()
      formData.append("file", file)

      // Upload the image
      const response = await fetch(`${apiUrl}/sellers/upload-profile-picture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized
          localStorage.removeItem("token")
          localStorage.removeItem("userId")
          router.push("/seller/login?session=expired")
          throw new Error("Session expired. Please log in again.")
        }
        throw new Error(`Failed to upload profile picture: ${response.status}`)
      }

      const data = await response.json()

      // Update the seller profile with the new profile picture path
      if (profile) {
        setProfile({
          ...profile,
          profilePicture: data.profilePicture || profile.profilePicture,
        })
        setEditValues({
          ...editValues,
          profilePicture: data.profilePicture || profile.profilePicture,
        })
      }

      toast({
        title: "Success",
        description: "Profile picture uploaded successfully",
      })

      // Refresh the profile data to get the updated profile picture
      fetchSellerProfile()
    } catch (err: any) {
      console.error("Error uploading profile picture:", err)
      setUploadError(err.message || "Failed to upload profile picture")
      toast({
        title: "Error",
        description: err.message || "Failed to upload profile picture",
        variant: "destructive",
      })
    } finally {
      setUploadingImage(false)
    }
  }

  // Add a function to fetch just the seller profile
  const fetchSellerProfile = async () => {
    try {
      const data = await getSellerProfile()
      setProfile(data)
      setEditValues(data)
    } catch (err) {
      console.error("Error fetching seller profile:", err)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleLogout = () => {
    logout()
    router.push("/seller/login")
  }

  return (
    <SellerProtectedRoute>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
          <div className="mb-8">
            <Link href="/seller/dashboard">
              <Image src="/logo.svg" alt="CIM Amplify Logo" width={150} height={50} className="h-auto" />
            </Link>
          </div>

          <nav className="flex-1 space-y-6">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 font-normal"
              onClick={() => router.push("/seller/dashboard")}
            >
              <HandshakeIcon className="h-5 w-5" />
              <span>My Deals</span>
            </Button>

            <Button
              variant="secondary"
              className="w-full justify-start gap-3 font-normal bg-teal-100 text-teal-700 hover:bg-teal-200"
            >
              <Pencil className="h-5 w-5" />
              <span>View Profile</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 font-normal"
              onClick={() => router.push("/seller/history")}
            >
              <History className="h-5 w-5" />
              <span>Off Market</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 font-normal text-red-600 hover:text-red-700 hover:bg-red-50 mt-auto"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </Button>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 p-6 flex justify-between items-center">
            <h1 className="text-4xl font-semibold text-gray-800">Profile</h1>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                {!editMode ? (
                  <Button onClick={handleEditToggle} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSaveAll} disabled={updating}>
                      {updating ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={handleEditToggle} disabled={updating}>
                      Cancel
                    </Button>
                  </div>
                )}

                {loading ? (
                  <>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </>
                ) : (
                  <>
                    <div className="text-right">
                      <div className="font-medium">{profile?.fullName || "User"}</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-medium">
                      {profile?.fullName ? profile.fullName.charAt(0) : "U"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Profile content */}
          <div className="p-8">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex gap-6">
                  <Skeleton className="h-40 w-40 rounded-lg" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-6 w-32" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-5 w-40" />
                    </div>
                  </div>
                </div>
                <div className="mt-8 space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center py-8">
                  <div className="text-red-500 text-lg mb-2">Error loading profile</div>
                  <p className="text-gray-600">{error}</p>
                  <Button className="mt-4" onClick={() => window.location.reload()}>
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow">
                {/* Profile header */}
                <div className="p-6 flex gap-6">
                  <div className="relative h-40 w-40 rounded-lg bg-gray-200 overflow-hidden">
                    {profile?.profilePicture ? (
                      <img
                        src={getProfilePictureUrl(profile.profilePicture) || "/placeholder.svg"}
                        alt={profile?.fullName || "Profile"}
                        className="h-40 w-40 rounded-lg object-cover"
                        onError={(e) => {
                          // Fallback to placeholder on error
                          ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                        }}
                      />
                    ) : (
                      <img src="/placeholder.svg" alt="Profile" className="h-40 w-40 rounded-lg object-cover" />
                    )}

                    {/* Upload button overlay */}
                    <button
                      onClick={triggerFileInput}
                      className="absolute bottom-2 right-2 bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-full shadow-md"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    </button>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>

                  <div className="flex-1">
                    {/* Full Name */}
                    <div className="flex items-center gap-2 mb-1">
                      {editMode ? (
                        <div className="flex-1">
                          <Input
                            value={editValues.fullName || ""}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, fullName: e.target.value }))}
                            className="text-2xl font-bold"
                            placeholder="Enter your full name"
                          />
                        </div>
                      ) : (
                        <h2 className="text-2xl font-bold">{profile?.fullName || "User"}</h2>
                      )}
                    </div>

                    {/* Title - Read Only */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-teal-600">{profile?.title || "CEO"}</div>
                    </div>

                    <div className="space-y-2">
                      {/* Email */}
                      <div className="flex items-center gap-2">
                        {editMode ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              type="email"
                              value={editValues.email || ""}
                              onChange={(e) => setEditValues((prev) => ({ ...prev, email: e.target.value }))}
                              className="text-gray-600"
                              placeholder="Enter your email"
                            />
                          </div>
                        ) : (
                          <div className="text-gray-600">{profile?.email || "Email not provided"}</div>
                        )}
                      </div>
                    </div>

                    {/* Change Password Button */}
                    <div className="mt-4">
                      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Change Password
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="newPassword">New Password</Label>
                              <div className="relative">
                                <Input
                                  id="newPassword"
                                  type={showPasswords.new ? "text" : "password"}
                                  value={passwordData.newPassword}
                                  onChange={(e) =>
                                    setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                                  }
                                  placeholder="Enter new password (min 6 characters)"
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                  onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                                >
                                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="confirmPassword">Confirm New Password</Label>
                              <div className="relative">
                                <Input
                                  id="confirmPassword"
                                  type={showPasswords.confirm ? "text" : "password"}
                                  value={passwordData.confirmPassword}
                                  onChange={(e) =>
                                    setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                                  }
                                  placeholder="Confirm new password"
                                />
                                <button
                                  type="button"
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                                  onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                                >
                                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={changePassword} disabled={updating}>
                                {updating ? "Changing..." : "Change Password"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>

                {/* Company information */}
                <div className="border-t border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Company Information</h3>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Company Name */}
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Company Name:</div>
                      {editMode ? (
                        <Input
                          value={editValues.companyName || ""}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, companyName: e.target.value }))}
                          placeholder="Enter company name"
                        />
                      ) : (
                        <div className="font-medium">{profile?.companyName || "Not provided"}</div>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Phone Number:</div>
                      {editMode ? (
                        <Input
                          value={editValues.phoneNumber || ""}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                          placeholder="+1 (555) 123-4567"
                        />
                      ) : (
                        <div className="font-medium">{profile?.phoneNumber || "Not provided"}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </SellerProtectedRoute>
  )
}
