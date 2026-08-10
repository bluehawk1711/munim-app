"use client";

import { useStore } from "@/app/store/useStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  Save,
  Building2,
  Palette,
  User,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
  const {
    companyDetails,
    updateCompanyDetails,
    documents,
    clearAllDocuments,
    resetAll,
  } = useStore();
  const { setTheme, theme } = useTheme();

  const [localDetails, setLocalDetails] = useState(companyDetails);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "saving">(
    "idle",
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setLocalDetails(companyDetails);
  }, [companyDetails]);

  const handleSave = () => {
    setSaveStatus("saving");
    updateCompanyDetails(localDetails);
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 300);
  };

  const handleDeleteAllDrafts = () => {
    clearAllDocuments();
    setShowDeleteConfirm(false);
  };

  const handleResetAll = () => {
    resetAll();
    setLocalDetails({ name: "", email: "", address: "" });
    setShowResetConfirm(false);
  };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Settings
          </h2>
          <p className="text-slate-400">
            Manage your account settings and preferences.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold"
        >
          {saveStatus === "saved" ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" /> Saved!
            </>
          ) : saveStatus === "saving" ? (
            "Saving..."
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger
            value="company"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
          >
            <Building2 className="h-4 w-4 mr-2" /> Company Profile
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
          >
            <User className="h-4 w-4 mr-2" /> Account
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
          >
            <Palette className="h-4 w-4 mr-2" /> Appearance
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Data
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Company Details</CardTitle>
              <CardDescription className="text-slate-400">
                These details will appear on your generated invoices and
                letters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-white">Company Name</Label>
                  <Input
                    className="bg-slate-800 border-slate-700 focus-visible:ring-amber-500"
                    value={localDetails.name}
                    onChange={(e) =>
                      setLocalDetails({ ...localDetails, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Email Address</Label>
                  <Input
                    className="bg-slate-800 border-slate-700 focus-visible:ring-amber-500"
                    value={localDetails.email}
                    onChange={(e) =>
                      setLocalDetails({
                        ...localDetails,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white">Address</Label>
                  <Input
                    className="bg-slate-800 border-slate-700 focus-visible:ring-amber-500"
                    value={localDetails.address}
                    onChange={(e) =>
                      setLocalDetails({
                        ...localDetails,
                        address: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Phone Number</Label>
                  <Input
                    className="bg-slate-800 border-slate-700 focus-visible:ring-amber-500"
                    value={localDetails.phoneNumber || ""}
                    onChange={(e) =>
                      setLocalDetails({
                        ...localDetails,
                        phoneNumber: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Theme Preferences</CardTitle>
              <CardDescription className="text-slate-400">
                Customize the look and feel of the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4 max-w-lg">
                <div
                  onClick={() => setTheme("dark")}
                  className={`cursor-pointer border-2 rounded-xl p-2 bg-slate-950 ${theme === "dark" ? "border-amber-500" : "border-slate-800 hover:border-slate-700"}`}
                >
                  <div className="h-24 rounded-lg bg-slate-900 mb-2 flex items-center justify-center">
                    <Moon className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-center text-sm font-medium text-white">
                    Dark Mode
                  </p>
                </div>
                <div
                  onClick={() => setTheme("light")}
                  className={`cursor-pointer border-2 rounded-xl p-2 bg-slate-100 ${theme === "light" ? "border-amber-500" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="h-24 rounded-lg bg-white mb-2 flex items-center justify-center border border-slate-200">
                    <Sun className="h-8 w-8 text-amber-500" />
                  </div>
                  <p className="text-center text-sm font-medium text-slate-900">
                    Light Mode
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">My Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-2xl bg-indigo-600 text-white">
                    AM
                  </AvatarFallback>
                </Avatar>
                <Button
                  variant="outline"
                  className="border-slate-700 text-white hover:bg-slate-800"
                >
                  Change Avatar
                </Button>
              </div>
              <Separator className="bg-slate-800" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-white">Display Name</Label>
                  <Input
                    className="bg-slate-800 border-slate-700"
                    defaultValue="Gaurav Dadhich"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Email</Label>
                  <Input
                    className="bg-slate-800 border-slate-700"
                    defaultValue="gouravdadhich13@gmail.com"
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-6">
          {/* Saved Drafts Info */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Saved Data</CardTitle>
              <CardDescription className="text-slate-400">
                Overview of your locally stored data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-2xl font-bold text-white">
                    {documents.length}
                  </p>
                  <p className="text-sm text-slate-400">Total Documents</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-2xl font-bold text-white">
                    {documents.filter((d) => d.type === "invoice").length}
                  </p>
                  <p className="text-sm text-slate-400">Invoices</p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-2xl font-bold text-white">
                    {documents.filter((d) => d.type === "job-letter").length}
                  </p>
                  <p className="text-sm text-slate-400">Job Letters</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-slate-900 border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-red-400">Danger Zone</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                These actions are irreversible. Proceed with caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Delete All Drafts */}
              <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Delete All Drafts
                  </p>
                  <p className="text-xs text-slate-400">
                    Remove all saved invoices and job letters. Company settings
                    will be kept.
                  </p>
                </div>
                {showDeleteConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleDeleteAllDrafts}
                    >
                      Confirm Delete
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete All
                  </Button>
                )}
              </div>

              {/* Reset Everything */}
              <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Reset Everything
                  </p>
                  <p className="text-xs text-slate-400">
                    Delete all drafts AND reset company details to defaults.
                  </p>
                </div>
                {showResetConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setShowResetConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleResetAll}
                    >
                      Confirm Reset
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" /> Reset All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
