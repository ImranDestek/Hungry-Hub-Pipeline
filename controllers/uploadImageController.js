const asyncHandler = require("express-async-handler");

const uploadBannerImage = asyncHandler(async (req, res) => {
  if (req.file) {
    return res
      .status(200)
      .json({ message: "File Uploaded Successfully.", success: true });
  } else {
    return res
      .status(400)
      .json({ message: "Please provide the file to upload.", success: false });
  }
});

const uploadCategoryImage = asyncHandler(async (req, res) => {
  if (req.file) {
    return res
      .status(200)
      .json({ message: "File Uploaded Successfully.", success: true });
  } else {
    return res
      .status(400)
      .json({ message: "Please provide the file to upload.", success: false });
  }
});

const uploadMItemImage = asyncHandler(async (req, res) => {
  if (req.file) {
    return res
      .status(200)
      .json({ message: "File Uploaded Successfully.", success: true });
  } else {
    return res
      .status(400)
      .json({ message: "Please provide the file to upload.", success: false });
  }
});

const uploadRestImage = asyncHandler(async (req, res) => {
  if (req.file) {
    return res
      .status(200)
      .json({ message: "File Uploaded Successfully.", success: true });
  } else {
    return res
      .status(400)
      .json({ message: "Please provide the file to upload.", success: false });
  }
});

module.exports = {
  uploadBannerImage,
  uploadCategoryImage,
  uploadMItemImage,
  uploadRestImage,
};
