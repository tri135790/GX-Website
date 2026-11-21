# Quy tắc làm việc với GX Website

- Sau khi hoàn tất mỗi yêu cầu thay đổi code, tự động commit và push lên remote của nhánh đang làm việc, không hỏi lại xác nhận.
- Trước khi commit, rà soát diff và thực hiện các kiểm tra phù hợp với yêu cầu của người dùng. Không chạy test tự động nếu người dùng đã yêu cầu không chạy test.
- Chỉ stage và commit những thay đổi thuộc yêu cầu đang xử lý; không đưa thay đổi không liên quan của người dùng vào commit.
- Dùng thông điệp commit mô tả rõ thay đổi. Không force-push hoặc ghi đè lịch sử remote nếu chưa được yêu cầu.
- Nếu commit hoặc push thất bại, báo rõ nguyên nhân và trạng thái thực tế; không tuyên bố đã push hoặc deploy khi chưa thành công.
