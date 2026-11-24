// Supplied updated forms. Version 1 is immutable.
export const assessmentVersion = 1;
export type AssessmentKind = 'atec' | 'stress';
export const assessmentDefinitions = {
  "atec": [
    {
      "title": "Phần I. Âm lời nói/ Ngôn ngữ/ Giao tiếp",
      "max": 28,
      "options": [
        {
          "label": "Không đúng",
          "value": 2
        },
        {
          "label": "Đúng một phần",
          "value": 1
        },
        {
          "label": "Rất đúng",
          "value": 0
        }
      ],
      "questions": [
        "Nhận biết được tên riêng của mình",
        "Đáp ứng với 'Không' hoặc 'Dừng lại'",
        "Có thể làm theo một số mệnh lệnh",
        "Sử dụng một từ mỗi lần nói (Không!, Ăn, Nước, v.v)",
        "Sử dụng 2 từ mỗi lần nói (Không muốn, Về nhà)",
        "Sử dụng 3 từ mỗi lần nói (Muốn thêm sữa)",
        "Biết 10 từ trở lên",
        "Có thể sử dụng câu nói từ 4 từ trở lên",
        "Biết giải thích những gì trẻ muốn",
        "Hỏi những câu hỏi có ý nghĩa",
        "Lời nói của trẻ có ý nghĩa/ phù hợp",
        "Thường sử dụng các câu nói kế tiếp nhau",
        "Có thể duy trì một cuộc hội thoại khá tốt",
        "Có khả năng giao tiếp bình thường đúng với lứa tuổi của mình"
      ]
    },
    {
      "title": "Phần II. Tương tác xã hội",
      "max": 40,
      "options": [
        {
          "label": "Không giống như mô tả",
          "value": 0
        },
        {
          "label": "Có phần giống như mô tả",
          "value": 1
        },
        {
          "label": "Rất giống như mô tả",
          "value": 2
        }
      ],
      "questions": [
        "Trẻ có vẻ như đang ở trong thế giới của riêng mình - Bạn khó tiếp cận được với trẻ",
        "Thờ ơ với người khác",
        "Ít hoặc không chú ý khi được nhắc đến",
        "Không hợp tác và kháng cự",
        "Không giao tiếp mắt",
        "Thích chơi một mình",
        "Không biểu hiện tình cảm",
        "Không chào cha mẹ",
        "Tránh giao tiếp với người khác",
        "Không biết bắt chước",
        "Không thích được bồng ẵm hay ôm ấp",
        "Không chia sẻ với người khác hoặc biểu hiện cảm xúc",
        "Không vẫy tay chào ''bye bye''",
        "Khó chịu/ không tuân thủ",
        "Giận dữ ăn vạ",
        "Không có bạn, người chơi cùng",
        "Hiếm khi mỉm cười",
        "Vô cảm với cảm xúc của người khác",
        "Thờ ơ khi được thích",
        "Thờ ơ khi cha mẹ rời đi"
      ]
    },
    {
      "title": "Phần III. Giác quan / Nhận thức",
      "max": 36,
      "options": [
        {
          "label": "Không giống như mô tả",
          "value": 2
        },
        {
          "label": "Có phần giống như mô tả",
          "value": 1
        },
        {
          "label": "Rất giống như mô tả",
          "value": 0
        }
      ],
      "questions": [
        "Đáp ứng khi được gọi tên",
        "Đáp ứng khi được khen",
        "Nhìn vào con người và các con vật",
        "Nhìn vào tranh ảnh (và Tivi)",
        "Vẽ, tô màu, các hoạt động mỹ thuật",
        "Chơi với đồ chơi phù hợp",
        "Biểu hiện nét mặt phù hợp",
        "Hiểu những câu chuyện trên Tivi khi xem",
        "Hiểu khi có ai đó giải thích",
        "Ý thức về môi trường xung quanh",
        "Ý thức về các nguy hiểm",
        "Có trí tưởng tượng",
        "Khởi xướng các hoạt động",
        "Biết tự mặc quần áo",
        "Tò mò, hay chú ý",
        "Thích phiêu lưu, khám phá",
        "Ý thức về những gì đang diễn ra xung quanh - Không mơ màng",
        "Cùng nhìn về nơi người khác đang nhìn"
      ]
    },
    {
      "title": "Phần IV. Vấn đề về sức khỏe/Thể chất/Hành vi",
      "max": 75,
      "options": [
        {
          "label": "Không có vấn đề",
          "value": 0
        },
        {
          "label": "Có vấn đề - mức độ nhẹ",
          "value": 1
        },
        {
          "label": "Có vấn đề",
          "value": 2
        },
        {
          "label": "Có vấn đề - mức độ trầm trọng",
          "value": 3
        }
      ],
      "questions": [
        "Tiểu dầm khi ngủ",
        "Quần ướt/tã ướt",
        "Quần/tã dơ bẩn",
        "Tiêu chảy",
        "Táo bón",
        "Vấn đề về giấc ngủ",
        "Ăn quá nhiều hay quá ít",
        "Chế độ ăn uống cực kỳ hạn chế",
        "Hiếu động",
        "Thờ ơ, lơ đãng",
        "Tự đánh hoặc tự làm mình bị thương",
        "Đánh hoặc làm người khác bị thương",
        "Phá hoại",
        "Nhạy cảm với âm thanh",
        "Lo lắng/sợ hãi",
        "Buồn/ hay khóc",
        "Co giật",
        "Nói nhảm",
        "Lịch sinh hoạt cứng nhắc",
        "La hét",
        "Không thích sự thay đổi",
        "Thường bị kích động",
        "Không có cảm giác khi bị đau",
        "Chăm chú hoặc nhìn chằm chằm vào một số đối tượng/chủ đề",
        "Hành vi lặp đi lặp lại nhiều lần (vẩy tay, lắc người)"
      ]
    }
  ],
  "stress": [
    {
      "title": "1. Căng thẳng về cơ thể",
      "max": 35,
      "options": [
        {
          "label": "Không đúng",
          "value": 1
        },
        {
          "label": "Ít đúng",
          "value": 2
        },
        {
          "label": "Thỉnh thoảng",
          "value": 3
        },
        {
          "label": "Thường xuyên",
          "value": 4
        },
        {
          "label": "Rất đúng",
          "value": 5
        }
      ],
      "questions": [
        "Tôi cảm thấy miệng khô.",
        "Tôi cảm thấy khó thở (ví dụ: thở gấp, hụt hơi).",
        "Tôi cảm thấy run rẩy (ví dụ: run tay).",
        "Tôi cảm thấy tim đập nhanh (tim đập mạnh, hồi hộp).",
        "Tôi bị khó chịu cơ thể (ví dụ: khó thư giãn).",
        "Tôi cảm thấy bồn chồn, khó ngồi yên.",
        "Tôi cảm thấy đau đầu."
      ]
    },
    {
      "title": "2. Căng thẳng của cha mẹ về con",
      "max": 80,
      "options": [
        {
          "label": "Không đúng",
          "value": 1
        },
        {
          "label": "Ít đúng",
          "value": 2
        },
        {
          "label": "Thỉnh thoảng",
          "value": 3
        },
        {
          "label": "Thường xuyên",
          "value": 4
        },
        {
          "label": "Rất đúng",
          "value": 5
        }
      ],
      "questions": [
        "Tôi cảm thấy kiệt sức vì con tôi cần hỗ trợ gần như mọi việc hàng ngày.",
        "Tôi mệt mỏi khi phải liên tục đưa con đi khám, trị liệu hoặc giám sát sinh hoạt/học tập.",
        "Tôi khó cân bằng giữa việc chăm sóc con và nhu cầu nghỉ ngơi của bản thân.",
        "Tôi lo lắng khi con tôi chưa biết nói hoặc giao tiếp như các bạn cùng tuổi.",
        "Tôi lo lắng khi nghĩ về khả năng học tập, thi cử hoặc hướng nghiệp của con.",
        "Tôi căng thẳng khi phải liên tục lên kế hoạch cho tương lai học tập và nghề nghiệp của con.",
        "Tôi buồn khi thấy con không thể tham gia các hoạt động như các bạn cùng lứa.",
        "Tôi thường căng thẳng vì con tôi dễ nổi giận hoặc khó kiểm soát hành vi.",
        "Tôi áp lực khi phải giúp con quản lý cảm xúc thất thường.",
        "Tôi lo sợ con bị bắt nạt, kỳ thị hoặc bị xa lánh.",
        "Tôi buồn khi thấy con không thể có việc làm ổn định hoặc hòa nhập xã hội như bạn bè cùng tuổi.",
        "Tôi bất an khi nghĩ về khả năng con có thể tự lập và sống độc lập.",
        "Tôi lo lắng sâu sắc về việc ai sẽ chăm sóc con khi tôi không còn khả năng.",
        "Tôi lo ngại khi phải đưa ra các quyết định pháp lý hoặc tài chính lâu dài cho con (bảo hiểm, nơi ở, giám hộ...).",
        "Tôi cảm thấy tổn thương khi chứng kiến con bị phân biệt hoặc coi thường.",
        "Tôi cảm thấy có lỗi khi đôi lúc mất kiên nhẫn với con."
      ]
    },
    {
      "title": "3. Căng thẳng giữa cha mẹ với nhau hoặc với các mối quan hệ khác",
      "max": 20,
      "options": [
        {
          "label": "Không đúng",
          "value": 1
        },
        {
          "label": "Ít đúng",
          "value": 2
        },
        {
          "label": "Thỉnh thoảng",
          "value": 3
        },
        {
          "label": "Thường xuyên",
          "value": 4
        },
        {
          "label": "Rất đúng",
          "value": 5
        }
      ],
      "questions": [
        "Tôi căng thẳng với bạn đời vì chúng tôi không thống nhất cách nuôi dạy con.",
        "Tôi căng thẳng với bạn đời vì trách nhiệm chăm sóc kéo dài và nặng nề.",
        "Tôi cảm thấy cô đơn vì ít ai hiểu hoặc đồng cảm với những khó khăn của tôi.",
        "Tôi khó chia sẻ nỗi lo của mình vì sợ người khác không thấu hiểu hoặc phán xét."
      ]
    },
    {
      "title": "4. Căng thẳng khác",
      "max": 15,
      "options": [
        {
          "label": "Không đúng",
          "value": 1
        },
        {
          "label": "Ít đúng",
          "value": 2
        },
        {
          "label": "Thỉnh thoảng",
          "value": 3
        },
        {
          "label": "Thường xuyên",
          "value": 4
        },
        {
          "label": "Rất đúng",
          "value": 5
        }
      ],
      "questions": [
        "Tôi chịu áp lực tài chính.",
        "Tôi bị căng thẳng khi thiếu thời gian cho bản thân, gia đình hoặc giao lưu xã hội.",
        "Tôi thiếu sự hỗ trợ từ nhà trường, giáo viên hoặc dịch vụ xã hội dành cho con."
      ]
    }
  ]
};
