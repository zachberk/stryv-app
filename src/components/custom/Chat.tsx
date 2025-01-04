"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { triggerPusherEvent } from "@/services/triggerPusherEvent";
import Link from "next/link";
import Pusher from "pusher-js";
import { Send, ArrowLeft, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_FILE_SIZE = 1 * 1024 * 1024;
const supabase = createClient();

interface MessageProp {
  id: string | null;
  conversation_id: string | null;
  content: string | null;
  message_type: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  sender_id: string | null;
  first_name: string | null;
  read: boolean;
}

interface ChatProps {
  initialMessages: MessageProp[];
  conversation_id: any;
}

interface GroupedMessages {
  [date: string]: MessageProp[];
};

const formatDateTime = (isoString: string | null) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Chat = ({ initialMessages, conversation_id }: ChatProps) => {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [conversationName, setConversationName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const closeModal = () => setSelectedImage(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        console.error(
          "Error fetching user:",
          error?.message || "No user found"
        );
        return;
      }
      setUserId(user.id); // Set user ID to state
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY as string, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER as string,
    });

    const channel = pusher.subscribe("stryv-test-development");
    channel.bind("new-message", (data: any) => {
      setMessages((prevMessages) => {
        if (data.sender_id === userId) {
          return prevMessages;
        }
        return [
          ...(prevMessages || []),
          {
            id: null,
            conversation_id: conversation_id,
            content: data.content,
            message_type: null,
            attachment_url: null,
            attachment_name: null,
            created_at: data.created_at,
            sender_id: data.sender_id,
            first_name: data.first_name || null,
            read: false,
          },
        ];
      });
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [userId]);

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      return { url: "", type: "" };
    }
    const file_path = `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("attachments")
      .upload(file_path, file);
    if (error) {
      console.error("Error uploading file:", error.message);
      return { url: "", type: "" };
    }

    const { data: publicUrl } = supabase.storage
      .from("attachments")
      .getPublicUrl(file_path);
    return {
      url: publicUrl.publicUrl || "",
      type: file.type,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error(
        "Error fetching user:",
        userError?.message || "No user found"
      );
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("accounts")
      .select("first_name")
      .eq("id", user.id);
    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError || "No profile found");
      return;
    }

    let attachment_url: any = "";
    let message_type = "text";
    let attachment_name: any = "";

    if (file) {
      console.log("File selected:", file.name);
      const { url, type } = await uploadFile(file);

      if (type.startsWith("image/")) {
        message_type = "image";
      } /* else if (type.startsWith("video/")) {
                message_type = "video";
            } */ else if (type === "application/pdf") {
        message_type = "pdf";
      } else if (type ==="application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        message_type = "docx";
      }

      if (!url) {
        console.log("File upload failed");
        return;
      }
      attachment_url = url;
      attachment_name = file.name;
    }

    const tempMessage: MessageProp = {
      id: null,
      conversation_id: conversation_id,
      content: newMessage,
      message_type: message_type,
      attachment_url: file ? URL.createObjectURL(file) : null, // Show local preview for file
      attachment_name: attachment_name,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      first_name: profile[0].first_name || null,
      read: false,
    };

    setMessages((prevMessages) => [...prevMessages, tempMessage]); // Optimistic update
    setNewMessage(""); // clear input field
    setFile(null);

    try {
      const { data: insertData, error: insertError } = await supabase
        .from("messages")
        .insert([
          {
            content: newMessage,
            conversation_id: conversation_id,
            sender_id: user.id,
            attachment_url: attachment_url,
            message_type: message_type,
          },
        ]);
      if (insertError) {
        console.error("Error sending message:", insertError.message);
        return;
      }

      const { data: updateData, error: updateError } = await supabase
          .from("conversations")
          .update({"updated_at": new Date().toISOString()})
          .eq("id", conversation_id);
      if (updateError) {
        console.error("Error in updating time new message is sent:", updateError.message);
      }

      const eventData = {
        sender_id: user.id,
        content: newMessage,
        first_name: profile[0].first_name || null,
        created_at: formatDateTime(new Date().toISOString()),
        attachment_url: attachment_url,
        message_type: message_type,
      };

      await triggerPusherEvent(
        "stryv-test-development",
        "new-message",
        eventData
      );
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  const getConversationName = async () => {
    if (messages.length > 0) {
      const { data, error } = await supabase
      .from("conversations")
      .select("title")
      .eq("id", messages[0].conversation_id);
      if (error) {
        console.error("Error fetching conversation name:", error);
      } else if (!data || data?.[0]?.title === null) {
        const { data: conversationData, error: conversationError } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", messages[0].conversation_id);
        const { data: accountData, error: accountError } = await supabase
            .from("accounts")
            .select("first_name")
            .eq("id", conversationData?.[0]?.user_id);
        setConversationName(accountData?.[0]?.first_name);
      } else {
        setConversationName(data?.[0]?.title || "Untitled Conversation");
      }
    }
  }
  useEffect(() => {
    getConversationName();
  }, []);

  const groupMessagesByDate = (msgs: MessageProp[]): GroupedMessages => {
    return msgs.reduce((acc: GroupedMessages, msg: MessageProp) => {
      const currentYear = new Date().getFullYear();
      const date = new Date(msg.created_at);
      const today = new Date();
      date.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      let dateFormatted;

      if (date.getTime() === today.getTime()) {
        dateFormatted = "Today";
      } else if (date.getFullYear() === currentYear) {
        dateFormatted = date.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric"
        });
      } else {
        dateFormatted = date.toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric"
        });
      }
      if (!acc[dateFormatted]) {
        acc[dateFormatted] = [];
      }
      acc[dateFormatted].push(msg);
      return acc;
    }, {});
  };

  const groupedMessages = groupMessagesByDate(messages);

  function formatTime(dateString: any) {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  useEffect(() => {
    if (messagesEndRef) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [groupedMessages]);

  const markMessageAsRead = async (message_id: string | null) => {
    const { error } = await supabase
        .from("message_reads")
        .upsert([
            {
                message_id,
                user_id: userId,
                read_at: new Date().toISOString(),
            },
        ]);

    if (error) {
        console.error("Error marking message as read:", error);
    } else {
        // Update the local state to reflect the read status
        setMessages((prevMessages) =>
            prevMessages.map((msg) =>
                msg.id === message_id ? { ...msg, read: true } : msg
            )
        );
    }
  };
  //console.log(userId);
  useEffect(() => {
    /* if (!userId) {
      console.error("User ID is not available.");
      return;
    } */
    const markMessagesAsRead = async () => {
        // Check if any message hasn't been read yet and mark it as read
        const unreadMessages = messages.filter((message) => !message.read);

        for (const message of unreadMessages) {
            await markMessageAsRead(message.id);
        }
    };
    markMessagesAsRead();
  }, [messages, userId]);

  console.log(messages);
  if (!messages[0].first_name) {
    return (
      <div className="h-full flex flex-col max-h-screen overflow-hidden bg-white">
        <div className="flex-none sticky top-0 z-10 bg-white p-6 shadow">
          <div className="flex items-center gap-4">
            <Link href={`/messages`}>
              <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h2 className="text-xl font-semibold text-gray-900">
              {conversationName}
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="text-center text-gray-500 text-sm font-medium mb-4">{date}</div>
              {msgs.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_id === userId ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.sender_id === userId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-900"
                    }`}
                    style={{
                      marginTop: index > 0 && msgs[index - 1].sender_id === msg.sender_id ? '0.15rem' : '0.5rem',
                    }}
                  >
                    {msg.message_type === "image" && msg.attachment_url && (
                      <div className="mt-2 relative group cursor-pointer">
                        <img
                          src={msg.attachment_url}
                          alt={msg.attachment_url.split("-").pop()}
                          className="max-w-full max-h-[30vh] p--3 object-contain border rounded cursor-pointed"
                          onClick={() => setSelectedImage(msg.attachment_url)}
                        />
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-30 transition-opacity rounded pointer-events-none"></div>
                      </div>
                    )}
                    {/* {msg.message_type === "video" && msg.attachment_url && (
                                        <div className="mt-2">
                                            <video
                                                controls
                                                className="max-w-full h-auto border rounded"
                                            >
                                                <source src={msg.attachment_url} type="video/mp4" />
                                                <source src={msg.attachment_url} type="video/quicktime" />
                                                Your browser does not support the video tag.
                                            </video>
                                        </div>
                                    )} */}
                    {msg.message_type === "pdf" && msg.attachment_url && (
                      <div>
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-900 underline"
                        >
                          {msg.attachment_name}{" "}
                          {msg.attachment_url.split("-").pop()}
                        </a>
                      </div>
                    )}
                    {msg.message_type === "docx" && msg.attachment_url && (
                      <div>
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-900 underline"
                        >
                          {msg.attachment_name}{" "}
                          {msg.attachment_url.split("-").pop()}
                        </a>
                      </div>
                    )}
                    <p className={`text-m ${msg.message_type !== "text" && msg.attachment_url ? "pt-2" : ""}`}>{msg.content}</p>
                    <span className="text-xs block opacity-70 text-right">
                      <i className="block text-sm select-none">
                        {msg?.created_at ? formatTime(msg.created_at) : ""}
                      </i>
                    </span>
                    <span>{msg.read ? "Read" : "Unread"}</span>
                  </div>
                </div>
                ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex-none sticky bottom-0 z-10 bg-gray-50 border-t p-6 shadow">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 w-full"
          >
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.mp4,.mov,.pdf,.docx"
              onChange={(e) => {
                const selectedFile = e.target.files ? e.target.files[0] : null;
                if (selectedFile) {
                  if (selectedFile.size > MAX_FILE_SIZE) {
                    alert(
                      `File size exceeds the limit of 1MB. Please select a smaller file.`
                    );
                    e.target.value = "";
                    return;
                  }
                  setFile(selectedFile);
                }
              }}
              ref={fileInputRef}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`px-4 py-2 rounded ${"bg-blue-500 text-white hover:bg-blue-600"}`}
            >
              <File className="w-4 h-4" />
            </Button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow p-2 border rounded resize-none h-10"
            />
            <Button
              type="submit"
              className={`px-4 py-2 rounded transition-all duration-200 ${
                newMessage.trim() === ""
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
              disabled={newMessage.trim() === ""}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
        {selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={closeModal}>
            <img src={selectedImage} alt="Expanded image" className="max-w-[80vw] max-h-[80vh] object-contain rounded" />
            <X className="w-8 h-8 text-gray-200 cursor-pointer absolute top-7 right-7" onClick={closeModal} />
          </div>
        )}
      </div>
    );
  } else {
    return (
      <div className="h-full flex flex-col max-h-screen overflow-hidden bg-white">
        <div className="flex-none sticky top-0 z-10 bg-white p-6 shadow">
          <div className="flex items-center gap-4">
            <Link href={`/messages`}>
              <Button variant="ghost" size="sm" className="hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h2 className="text-xl font-semibold text-gray-900">
              {conversationName}
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="text-center text-gray-500 text-sm font-medium mb-4">{date}</div>
            {msgs.map((msg, index) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_id === userId ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    msg.sender_id === userId
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900"
                  }`}
                  style={{
                    marginTop: index > 0 && msgs[index - 1].sender_id === msg.sender_id ? '0.15rem' : '0.5rem',
                  }}
                >
                  {msg.sender_id !== userId && (
                    <strong>{msg?.first_name || "Anonymous"}</strong>
                  )}
                  {msg.message_type === "image" && msg.attachment_url && (
                    <div className="mt-2 relative group cursor-pointer">
                      <img
                        src={msg.attachment_url}
                        alt={msg.attachment_url.split("-").pop()}
                        className="max-w-full max-h-[30vh] p--3 object-contain border rounded cursor-pointed"
                        onClick={() => setSelectedImage(msg.attachment_url)}
                      />
                      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-30 transition-opacity rounded pointer-events-none"></div>
                    </div>
                  )}
                  {/* {msg.message_type === "video" && msg.attachment_url && (
                                      <div className="mt-2">
                                          <video
                                              controls
                                              className="max-w-full h-auto border rounded"
                                          >
                                              <source src={msg.attachment_url} type="video/mp4" />
                                              <source src={msg.attachment_url} type="video/quicktime" />
                                              Your browser does not support the video tag.
                                          </video>
                                      </div>
                                  )} */}
                  {msg.message_type === "pdf" && msg.attachment_url && (
                    <div>
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 underline"
                      >
                        {msg.attachment_name}{" "}
                        {msg.attachment_url.split("-").pop()}
                      </a>
                    </div>
                  )}
                  {msg.message_type === "docx" && msg.attachment_url && (
                    <div>
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-900 underline"
                      >
                        {msg.attachment_name}{" "}
                        {msg.attachment_url.split("-").pop()}
                      </a>
                    </div>
                  )}
                  <p className={`text-m ${msg.message_type !== "text" && msg.attachment_url ? "pt-2" : ""}`}>{msg.content}</p>
                  <span className="text-xs block opacity-70 text-right">
                    <i className="block text-sm select-none">
                      {msg?.created_at ? formatTime(msg.created_at) : ""}
                    </i>
                  </span>
                  <span>{msg.read ? "Read" : "Unread"}</span>
                </div>
              </div>
              ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex-none sticky bottom-0 z-10 bg-gray-50 border-t p-6 shadow">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 w-full"
          >
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.mp4,.mov,.pdf,.docx"
              onChange={(e) => {
                const selectedFile = e.target.files ? e.target.files[0] : null;
                if (selectedFile) {
                  if (selectedFile.size > MAX_FILE_SIZE) {
                    alert(
                      `File size exceeds the limit of 1MB. Please select a smaller file.`
                    );
                    e.target.value = "";
                    return;
                  }
                  setFile(selectedFile);
                }
              }}
              ref={fileInputRef}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`px-4 py-2 rounded ${"bg-blue-500 text-white hover:bg-blue-600"}`}
            >
              <File className="w-4 h-4" />
            </Button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow p-2 border rounded resize-none h-10"
            />
            <Button
              type="submit"
              className={`px-4 py-2 rounded transition-all duration-200 ${
                newMessage.trim() === ""
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
              disabled={newMessage.trim() === ""}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
        {selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={closeModal}>
            <img src={selectedImage} alt="Expanded image" className="max-w-[80vw] max-h-[80vh] object-contain rounded" />
            <X className="w-8 h-8 text-gray-200 cursor-pointer absolute top-7 right-7" onClick={closeModal} />
          </div>
        )}
      </div>
    );
  }
};

export default Chat;