export const issues: Record<string, [string, string]> = {
  invalid_gstin: [
    "GSTIN format or checksum could not be verified. Upload a clearer certificate.",
    "GSTIN का प्रारूप या चेकसम सत्यापित नहीं हुआ। साफ़ प्रमाणपत्र अपलोड करें।",
  ],
  registry_missing: [
    "This registration was not found in the supplied mock registry.",
    "यह पंजीकरण दिए गए काल्पनिक रजिस्टर में नहीं मिला।",
  ],
  gst_inactive: [
    "This GST registration is inactive, suspended, or cancelled.",
    "यह GST पंजीकरण निष्क्रिय, निलंबित या रद्द है।",
  ],
  business_mismatch: [
    "The business name does not match your profile and registration.",
    "व्यवसाय का नाम प्रोफ़ाइल और पंजीकरण से मेल नहीं खाता।",
  ],
  address_mismatch: [
    "The shop address or location does not match the evidence.",
    "दुकान का पता या स्थान दस्तावेज़ से मेल नहीं खाता।",
  ],
  address_date: [
    "Use address proof dated within 90 days before 15 July 2026. Future dates are not accepted.",
    "15 जुलाई 2026 से पहले के 90 दिनों का पता प्रमाण दें। भविष्य की तारीख स्वीकार नहीं है।",
  ],
  signatory_mismatch: [
    "The signatory name could not be matched to your profile.",
    "हस्ताक्षरकर्ता का नाम प्रोफ़ाइल से मेल नहीं खाता।",
  ],
  document_unreadable: [
    "The document could not be read clearly. Retake or replace it.",
    "दस्तावेज़ साफ़ नहीं पढ़ा गया। दोबारा तस्वीर लें या बदलें।",
  ],
  processing_failed: [
    "Processing failed. Check that the server OCR assets are prepared, then retry.",
    "प्रसंस्करण विफल हुआ। सर्वर पर OCR डेटा तैयार करके फिर कोशिश करें।",
  ],
  processing_interrupted: [
    "The server restarted during processing. Please upload again.",
    "जाँच के दौरान सर्वर फिर शुरू हुआ। दोबारा अपलोड करें।",
  ],
  manual_review: [
    "Your correction needs review against a replacement document.",
    "सुधार की जाँच के लिए नया दस्तावेज़ दें।",
  ],
};
export const documentLabels = {
  gst: ["GST certificate", "GST प्रमाणपत्र"],
  udyam: ["Udyam certificate", "उद्यम प्रमाणपत्र"],
  address: ["Address proof", "पता प्रमाण"],
  signatory: ["Signatory ID", "हस्ताक्षरकर्ता ID"],
} as const;
export const statusLabels = {
  processing: ["Checking document", "दस्तावेज़ की जाँच जारी"],
  verified: ["Verified", "सत्यापित"],
  replacement_needed: ["Replacement needed", "नया दस्तावेज़ चाहिए"],
  review_required: ["Review required", "समीक्षा आवश्यक"],
} as const;
export const fieldLabels: Record<string, [string, string]> = {
  gstin: ["GSTIN", "GSTIN"],
  udyam: ["Udyam number", "उद्यम नंबर"],
  businessName: ["Business name", "व्यवसाय का नाम"],
  status: ["Registry status", "रजिस्ट्री स्थिति"],
  billDate: ["Bill date", "बिल की तारीख"],
  address: ["Address", "पता"],
  signatoryName: ["Signatory name", "हस्ताक्षरकर्ता का नाम"],
};
