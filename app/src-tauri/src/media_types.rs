//! Single source of truth for filename → MIME mapping.
//!
//! Telegram reports `application/octet-stream` for many documents uploaded by
//! other clients. Serving that Content-Type makes the WebView refuse to decode
//! otherwise-playable media, so every place that hands a file to the WebView,
//! to Android's MediaStore, or to the asset protocol resolves the type here.

/// MIME type for a lowercase extension, without the leading dot.
pub fn mime_for_extension(extension: &str) -> Option<&'static str> {
    let mime = match extension {
        // Images
        "jpg" | "jpeg" | "jfif" => "image/jpeg",
        "png" => "image/png",
        "apng" => "image/apng",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "heic" => "image/heic",
        "heif" => "image/heif",
        "tif" | "tiff" => "image/tiff",

        // Video
        "mp4" => "video/mp4",
        "m4v" => "video/x-m4v",
        "webm" => "video/webm",
        "ogv" => "video/ogg",
        "mov" => "video/quicktime",
        "3gp" => "video/3gpp",
        "3g2" => "video/3gpp2",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "wmv" => "video/x-ms-wmv",
        "flv" => "video/x-flv",
        "mpg" | "mpeg" => "video/mpeg",
        "ts" | "m2ts" => "video/mp2t",

        // Audio
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "flac" => "audio/flac",
        "ogg" | "oga" => "audio/ogg",
        "opus" => "audio/opus",
        "weba" => "audio/webm",
        "wav" => "audio/wav",

        // Documents and archives
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "zip" => "application/zip",
        "rar" => "application/vnd.rar",
        "7z" => "application/x-7z-compressed",

        _ => return None,
    };
    Some(mime)
}

/// MIME type inferred from a path or filename, falling back to a generic type.
pub fn mime_for_path(path: &str) -> &'static str {
    std::path::Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .and_then(|extension| mime_for_extension(&extension))
        .unwrap_or(GENERIC_MIME)
}

pub const GENERIC_MIME: &str = "application/octet-stream";

/// Whether a reported MIME type carries no format information, and so should be
/// replaced by one derived from the filename.
pub fn is_generic_mime(mime: &str) -> bool {
    let mime = mime.trim();
    mime.is_empty()
        || mime.eq_ignore_ascii_case(GENERIC_MIME)
        || mime.eq_ignore_ascii_case("binary/octet-stream")
        || mime.eq_ignore_ascii_case("application/binary")
}

/// Canonical file extension for a MIME type, without the leading dot.
pub fn extension_for_mime(mime: &str) -> Option<&'static str> {
    let mime = mime.trim().to_ascii_lowercase();
    let extension = match mime.split(';').next().unwrap_or("").trim() {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/apng" => "apng",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/avif" => "avif",
        "image/bmp" | "image/x-ms-bmp" => "bmp",
        "image/svg+xml" => "svg",
        "image/x-icon" | "image/vnd.microsoft.icon" => "ico",
        "image/heic" | "image/heic-sequence" => "heic",
        "image/heif" | "image/heif-sequence" => "heif",
        "image/tiff" => "tiff",

        "video/mp4" => "mp4",
        "video/x-m4v" => "m4v",
        "video/webm" => "webm",
        "video/ogg" => "ogv",
        "video/quicktime" => "mov",
        "video/3gpp" => "3gp",
        "video/3gpp2" => "3g2",
        "video/x-matroska" => "mkv",
        "video/x-msvideo" => "avi",
        "video/x-ms-wmv" => "wmv",
        "video/x-flv" => "flv",
        "video/mpeg" => "mpg",
        "video/mp2t" => "ts",

        "audio/mpeg" => "mp3",
        "audio/mp4" | "audio/x-m4a" => "m4a",
        "audio/aac" => "aac",
        "audio/flac" | "audio/x-flac" => "flac",
        "audio/ogg" => "oga",
        "audio/opus" => "opus",
        "audio/webm" => "weba",
        "audio/wav" | "audio/x-wav" => "wav",

        "application/pdf" => "pdf",
        "text/plain" => "txt",
        "application/zip" => "zip",

        _ => return None,
    };
    Some(extension)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_the_formats_the_webview_renders() {
        assert_eq!(mime_for_path("holiday.webp"), "image/webp");
        assert_eq!(mime_for_path("holiday.AVIF"), "image/avif");
        assert_eq!(mime_for_path("clip.webm"), "video/webm");
        assert_eq!(mime_for_path("clip.MKV"), "video/x-matroska");
        assert_eq!(mime_for_path("/tmp/home_42.mov"), "video/quicktime");
    }

    #[test]
    fn falls_back_to_the_generic_type_for_unknown_names() {
        assert_eq!(mime_for_path("archive.unknownext"), GENERIC_MIME);
        assert_eq!(mime_for_path("no-extension"), GENERIC_MIME);
    }

    #[test]
    fn treats_only_information_free_types_as_generic() {
        assert!(is_generic_mime(""));
        assert!(is_generic_mime("  "));
        assert!(is_generic_mime("application/octet-stream"));
        assert!(is_generic_mime("Binary/Octet-Stream"));
        assert!(!is_generic_mime("video/webm"));
        assert!(!is_generic_mime("image/webp"));
    }

    #[test]
    fn separates_still_images_from_video_by_reported_type_or_name() {
        // The thumbnail fallback downloads the original, so misclassifying a
        // video here would pull a whole movie to build one card image.
        assert!(mime_for_path("holiday.webp").starts_with("image/"));
        assert!(mime_for_path("holiday.heic").starts_with("image/"));
        assert!(!mime_for_path("clip.webm").starts_with("image/"));
        assert!(!mime_for_path("clip.mkv").starts_with("image/"));
        assert!(!mime_for_path("movie-without-extension").starts_with("image/"));
    }

    #[test]
    fn maps_telegram_mime_types_back_to_cache_extensions() {
        assert_eq!(extension_for_mime("image/webp"), Some("webp"));
        assert_eq!(extension_for_mime("video/webm"), Some("webm"));
        assert_eq!(extension_for_mime("image/heic"), Some("heic"));
        assert_eq!(
            extension_for_mime("video/mp4; codecs=\"avc1\""),
            Some("mp4")
        );
        assert_eq!(extension_for_mime("application/octet-stream"), None);
    }
}
