import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { useAuthStore } from "@/lib/store";
import {
  fetchTrainingSlides,
  fetchUserTrainingProgress,
  markSlideViewed,
  updateProfile,
} from "@/lib/supabase";
import type { TrainingSlide } from "@/types";

export function Onboarding() {
  const navigate = useNavigate();
  const { profile, setProfile } = useAuthStore();

  const [slides, setSlides] = useState<TrainingSlide[]>([]);
  const [completedSlideIds, setCompletedSlideIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [slideStartTime, setSlideStartTime] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [slidesRes, progressRes] = await Promise.all([
        fetchTrainingSlides(),
        fetchUserTrainingProgress(profile.id),
      ]);
      if (slidesRes.data) setSlides(slidesRes.data);
      if (progressRes.data) {
        const ids = new Set(progressRes.data.map((p) => p.slide_id));
        setCompletedSlideIds(ids);
        // Resume from first incomplete slide
        const firstIncomplete = slidesRes.data?.findIndex((s) => !ids.has(s.id)) ?? 0;
        const resumeIndex = firstIncomplete === -1 ? (slidesRes.data?.length ?? 1) - 1 : firstIncomplete;
        setCurrentIndex(resumeIndex);
      }
      setIsLoading(false);
    }
    load();
  }, [profile]);

  const currentSlide = slides[currentIndex];

  // Per-slide countdown timer
  useEffect(() => {
    if (!currentSlide) return;
    const lockDuration = currentSlide.lock_duration_seconds;
    setLockRemaining(completedSlideIds.has(currentSlide.id) ? 0 : lockDuration);
    setSlideStartTime(Date.now());
  }, [currentIndex, currentSlide, completedSlideIds]);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockRemaining]);

  const handleNext = useCallback(async () => {
    if (!profile || !currentSlide || lockRemaining > 0) return;

    const duration = Math.round((Date.now() - slideStartTime) / 1000);
    await markSlideViewed(profile.id, currentSlide.id, duration);
    setCompletedSlideIds((prev) => new Set([...prev, currentSlide.id]));

    if (currentIndex < slides.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [profile, currentSlide, lockRemaining, slideStartTime, currentIndex, slides.length]);

  const handleComplete = async () => {
    if (!profile || !currentSlide || lockRemaining > 0) return;
    setIsCompleting(true);

    const duration = Math.round((Date.now() - slideStartTime) / 1000);
    await markSlideViewed(profile.id, currentSlide.id, duration);

    const updatedProfile = await updateProfile(profile.id, {
      onboarding_status: "completed",
      onboarding_completed_at: new Date().toISOString(),
    });

    if (updatedProfile.data) setProfile(updatedProfile.data);
    navigate("/dashboard");
  };

  const overallProgress = slides.length > 0
    ? ((completedSlideIds.size + (lockRemaining === 0 && currentSlide && !completedSlideIds.has(currentSlide.id) ? 1 : 0)) / slides.length) * 100
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <p className="text-text-muted font-sans">No training content available.</p>
      </div>
    );
  }

  const isLastSlide = currentIndex === slides.length - 1;
  const allPreviousCompleted = currentIndex === 0 || completedSlideIds.has(slides[currentIndex - 1]?.id);

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6 bg-gradient-radial">
      <div className="w-full max-w-2xl animate-fade_in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="font-sora font-bold text-xl text-text-primary">
            zab<span className="text-coral">eta</span>
          </span>
          <span className="text-xs font-grotesk text-text-muted">
            Step {currentIndex + 1} of {slides.length}
          </span>
        </div>

        {/* Overall progress */}
        <Progress value={overallProgress} variant="coral" size="sm" className="mb-8" />

        {/* Slide card */}
        <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/30">
          {/* Slide image placeholder */}
          {currentSlide.image_url ? (
            <img
              src={currentSlide.image_url}
              alt={currentSlide.title}
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-40 bg-bg-elevated border-b border-border flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center">
                <span className="text-coral font-sora font-bold text-lg">
                  {currentIndex + 1}
                </span>
              </div>
            </div>
          )}

          <div className="p-8">
            <h2 className="font-sora font-semibold text-text-primary text-2xl mb-3">
              {currentSlide.title}
            </h2>
            <p className="text-text-muted font-sans text-base leading-relaxed">
              {currentSlide.content}
            </p>

            {/* Lock timer */}
            <div className="mt-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {lockRemaining > 0 ? (
                  <>
                    <div className="relative w-10 h-10 shrink-0">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                        <circle
                          cx="20" cy="20" r="16"
                          fill="none" stroke="#2A2D3E" strokeWidth="3"
                        />
                        <circle
                          cx="20" cy="20" r="16"
                          fill="none" stroke="#FF4D6D" strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 16}`}
                          strokeDashoffset={
                            2 * Math.PI * 16 * (1 - lockRemaining / currentSlide.lock_duration_seconds)
                          }
                          className="transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-grotesk font-semibold text-coral">
                        {lockRemaining}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted font-sans">
                      Please read before continuing
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-lime font-sans flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse_lime inline-block" />
                    Ready to continue
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                {currentIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => setCurrentIndex((i) => i - 1)}
                  >
                    Back
                  </Button>
                )}
                {isLastSlide ? (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={lockRemaining > 0}
                    isLoading={isCompleting}
                    onClick={handleComplete}
                  >
                    Complete Training
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={lockRemaining > 0 || !allPreviousCompleted}
                    onClick={handleNext}
                  >
                    Continue
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Slide dots */}
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => completedSlideIds.has(slide.id) || i === 0 ? setCurrentIndex(i) : null}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentIndex
                  ? "w-6 bg-coral"
                  : completedSlideIds.has(slide.id)
                  ? "bg-lime/50"
                  : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
