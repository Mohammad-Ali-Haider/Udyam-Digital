import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { Api } from "./api";
export async function downloadCsv(api: Api, path: string, name: string) {
  const text = await api.request<string>(path);
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(text);
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        dialogTitle: name,
      });
    } finally {
      file.delete();
    }
  }
}
