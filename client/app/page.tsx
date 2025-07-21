"use client";

import "./globals.css";
import "react-day-picker/dist/style.css";
import { DayPicker } from "react-day-picker";
import { useState } from "react";
import { sk } from "date-fns/locale";
import { format, startOfDay, isSameDay } from "date-fns";
import { Banner } from "./components/Banner";

export default function CalendarComponent() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [userData, setUserData] = useState({
    name: "",
    phone: "",
  });
  const [showNotification, setShowNotification] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const ITEMS_PER_PAGE = 6;

  const disabledDays = [{ before: new Date() }, { dayOfWeek: [0] }];

  const times = [
    "09:00",
    "09:45",
    "10:30",
    "11:15",
    "12:00",
    "12:45",
    "13:30",
    "14:15",
    "15:00",
    "15:45",
    "16:30",
    "17:15",
    "18:00",
    "18:45",
    "19:30",
    "20:15",
  ];

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      setSelectedTime(null);
      setCurrentPage(0); // Reset pagination when selecting a new date

      // Verificar horarios ocupados
      try {
        const response = await fetch("/api/google-calendar/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: format(date, "yyyy-MM-dd"),
          }),
        });

        const data = await response.json();
        if (data.bookedTimes) {
          setBookedTimes(data.bookedTimes);
        }
      } catch (error) {
        console.error("Chyba pri kontrole plánov:", error);
      }
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleUserDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime || !userData.name || !userData.phone)
      return;

    try {
      const response = await fetch("/api/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(selectedDate, "yyyy-MM-dd"),
          time: selectedTime + ":00",
          userData: {
            name: userData.name,
            phone: userData.phone,
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.eventId) {
        setShowNotification(true);
        setSelectedDate(undefined);
        setSelectedTime(null);
        setUserData({ name: "", phone: "" });
        setTimeout(() => setShowNotification(false), 5000);
      } else {
        throw new Error(data.error || "Chyba pri spracovaní rezervácie");
      }
    } catch (error) {
      alert("Chyba: Rezerváciu sa nepodarilo potvrdiť. Skúste to znova.");
      console.error("Error:", error);
    }
  };

  const isTimeDisabled = (time: string) => {
    if (!selectedDate) return false;

    const now = new Date();
    const [hours, minutes] = time.split(":").map(Number);
    const selectedDateTime = new Date(selectedDate);
    selectedDateTime.setHours(hours, minutes);

    if (isSameDay(selectedDate, now) && selectedDateTime < now) {
      return true;
    }

    return bookedTimes.includes(time);
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat  sm:p-4 md:p-8 flex flex-col items-center justify-center"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('https://as1.ftcdn.net/v2/jpg/09/25/96/90/1000_F_925969089_BUBoCzHXSm5w9w7IquT3ahchBZ5g0QEW.jpg')`,
      }}
    >
      {/* Notification stays fixed */}
      {showNotification && (
        <div className="fixed top-4 right-4 left-4 mx-auto max-w-sm bg-green-50/90 backdrop-blur-sm text-green-900 px-6 py-4 rounded-2xl shadow-xl border border-green-100 animate-fade-in z-50">
          <div className="flex items-center space-x-2">
            <svg
              className="w-6 h-6 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div>
              <p className="font-medium">Rezervácia potvrdená!</p>
              <p className="text-sm text-green-800">
                Váš termín bol úspešne naplánovaný.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-[375px] mx-auto relative">
        {/* Phone Frame */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black rounded-[2rem] sm:rounded-[3rem] -m-3 sm:-m-4 shadow-[0_0_15px_rgba(0,0,0,0.5),inset_0_0_15px_rgba(255,255,255,0.1)] transform rotate-0 hover:rotate-1 transition-transform duration-300"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 sm:w-40 h-5 sm:h-6 bg-black rounded-b-3xl shadow-inner"></div>

        {/* Screen Content */}
        <div className="relative bg-white/95 backdrop-blur-sm rounded-[1.8rem] sm:rounded-[2.5rem] shadow-[inset_0_1px_1px_rgba(0,0,0,0.12)] p-4 sm:p-8 space-y-6 min-h-[600px] sm:min-h-[700px] overflow-y-auto">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-1 bg-gray-800/80 rounded-full shadow-sm"></div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 sm:w-16 h-1 bg-gray-800/80 rounded-full shadow-sm"></div>
          <div className="flex justify-center my-4">
            <Banner />
          </div>

          <div className="py-2">
            <DayPicker
              animate
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={sk}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              showOutsideDays
              weekStartsOn={1}
              className="rdp !w-full [&_.rdp-day_focus]:ring-0 [&_.rdp-day_focus]:outline-none [&_.rdp-day]:rounded-xl [&_.rdp-head]:mt-0"
              disabled={disabledDays}
              modifiers={{
                sunday: [{ dayOfWeek: [0] }],
                today: new Date(),
              }}
              modifiersStyles={{
                sunday: { color: "#EF4444" },
                today: {
                  backgroundColor: "#000",
                  color: "#fff",
                  fontWeight: "bold",
                  borderRadius: "1rem",
                },
                selected: {
                  color: "orange",
                  transform: "scale(1.1)",
                  transition: "all 0.2s ease",
                  borderRadius: "3rem",
                },
              }}
              modifiersClassNames={{
                day: "hover:bg-gray-100 hover:scale-110 transition-all duration-200 rounded-2xl",
              }}
              styles={{
                caption: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  backgroundColor: "rgb(249 250 251 / 0.8)",
                  borderRadius: "1rem",
                  marginBottom: "1rem",
                },
                nav: { display: "flex", gap: "0.5rem" },
                nav_button: {
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgb(249 250 251 / 0.8)",
                  color: "rgb(156 163 175 / 0.8)",
                  transition: "all 0.2s ease",
                },
                day: { borderRadius: "1rem" },
              }}
              formatters={{
                formatWeekdayName: (weekday) =>
                  format(weekday, "EEEEEE", { locale: sk })
                    .charAt(0)
                    .toUpperCase() +
                  format(weekday, "EEEEEE", { locale: sk }).slice(1),
              }}
            />
          </div>

          {selectedDate && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 text-center">
                Dostupné časy
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {times
                  .slice(
                    currentPage * ITEMS_PER_PAGE,
                    (currentPage + 1) * ITEMS_PER_PAGE
                  )
                  .map((time) => (
                    <button
                      key={time}
                      onClick={() => handleTimeSelect(time)}
                      disabled={isTimeDisabled(time)}
                      className={`py-2.5 px-3 text-sm font-medium rounded-xl transition-all duration-300 
          ${
            isTimeDisabled(time)
              ? "bg-red-50/80 text-red-500 cursor-not-allowed"
              : selectedTime === time
              ? "bg-black text-white shadow-lg ring-2 ring-black ring-offset-2 scale-105"
              : "bg-green-50/80 text-green-700 hover:bg-green-100 hover:shadow-md hover:scale-105"
          }`}
                    >
                      {time}
                    </button>
                  ))}
              </div>
              <div className="text-gray-800 flex justify-center gap-2 pt-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentPage === 0}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ◀
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(
                        Math.floor((times.length - 1) / ITEMS_PER_PAGE),
                        prev + 1
                      )
                    )
                  }
                  disabled={(currentPage + 1) * ITEMS_PER_PAGE >= times.length}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ▶
                </button>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-gray-200/50 space-y-6">
            {selectedDate && selectedTime ? (
              <>
                <div className="bg-gray-50/80 backdrop-blur-sm p-5 rounded-2xl">
                  <p className="text-gray-600 text-sm text-center">
                    Termín: <br />
                    <span className="font-medium text-black capitalize text-lg">
                      {format(selectedDate, "d  MMMM  yyyy", {
                        locale: sk,
                      })}
                    </span>
                    <br />
                    čas{" "}
                    <span className="font-medium text-black text-lg">
                      {selectedTime}
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    name="name"
                    value={userData.name}
                    onChange={handleUserDataChange}
                    placeholder="Vaše celé meno"
                    className="text-gray-400 w-full px-5 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white/80 backdrop-blur-sm"
                    required
                  />
                  <input
                    type="tel"
                    name="phone"
                    value={userData.phone}
                    onChange={handleUserDataChange}
                    placeholder="váš telefón"
                    className="text-gray-400 w-full px-5 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all bg-white/80 backdrop-blur-sm"
                    required
                  />
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">
                Vyberte dátum a čas rezervácie
              </p>
            )}

            <button
              onClick={handleConfirmBooking}
              className={`w-full py-5 px-6 rounded-2xl text-white font-medium transition-all duration-300 
                ${
                  selectedDate &&
                  selectedTime &&
                  userData.name &&
                  userData.phone
                    ? "bg-black hover:bg-gray-900 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                    : "bg-gray-200 cursor-not-allowed"
                }`}
              disabled={
                !selectedDate ||
                !selectedTime ||
                !userData.name ||
                !userData.phone
              }
            >
              Potvrďte rezerváciu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
