import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TrashPage = () => {
  const [trashItems, setTrashItems] = useState({
    projects: [],
    folders: [],
    videos: [],
    files: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrashItems = async () => {
      try {
        const response = await fetch("/api/trash");
        if (!response.ok) {
          throw new Error("Failed to fetch trash items");
        }
        const data = await response.json();
        setTrashItems(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load trash items.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrashItems();
  }, []);

  const handleRestore = async (type, id) => {
    try {
      const response = await fetch(`/api/trash/${type}/${id}/restore`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to restore item");
      }
      // Refresh the list
      setTrashItems((prevItems) => ({
        ...prevItems,
        [type + "s"]: prevItems[type + "s"].filter((item) => item.id !== id),
      }));
      toast.success("Item restored successfully.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to restore item.");
    }
  };

  const handlePermanentDelete = async (type, id) => {
    try {
      const response = await fetch(`/api/trash/${type}/${id}/permanent`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to permanently delete item");
      }
      // Refresh the list
      setTrashItems((prevItems) => ({
        ...prevItems,
        [type + "s"]: prevItems[type + "s"].filter((item) => item.id !== id),
      }));
      toast.success("Item permanently deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to permanently delete item.");
    }
  };

  const renderItems = (items, type) => {
    if (!items || items.length === 0) {
      return <p>No {type} in the trash.</p>;
    }

    return (
      <ul>
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between p-2 border-b">
            <span>{item.name}</span>
            <div>
              <Button
                onClick={() => handleRestore(type, item.id)}
                variant="outline"
                size="sm"
                className="mr-2"
              >
                Restore
              </Button>
              <Button
                onClick={() => handlePermanentDelete(type, item.id)}
                variant="destructive"
                size="sm"
              >
                Delete Permanently
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Trash</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Projects</h2>
        {renderItems(trashItems.projects, "project")}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Folders</h2>
        {renderItems(trashItems.folders, "folder")}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Videos</h2>
        {renderItems(trashItems.videos, "video")}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Files</h2>
        {renderItems(trashItems.files, "file")}
      </div>
    </div>
  );
};

export default TrashPage;
